#!/usr/bin/env bash
# Run as root on the new VM after bootstrap and image import, never on the local cluster.
set -euo pipefail
umask 077

if [[ $# -ne 4 ]]; then
  echo 'Usage: deploy-on-vm.sh IMAGE_TAG GATEWAY_HOST STORE_HOST ADMIN_EMAIL' >&2
  exit 2
fi
tag=$1
gateway_host=$2
store_host=$3
admin_email=$4
for host in "$gateway_host" "$store_host"; do
  [[ "$host" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]+$ ]] || { echo 'Invalid host.' >&2; exit 2; }
done
[[ "$tag" =~ ^[a-zA-Z0-9._-]+$ ]] || { echo 'Invalid image tag.' >&2; exit 2; }
[[ "$admin_email" =~ ^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+$ ]] || { echo 'Invalid admin email.' >&2; exit 2; }
[[ -f /opt/urumi/bootstrap-ready ]] || { echo 'Wait for cloud-init bootstrap first.' >&2; exit 1; }
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
cd /opt/urumi/release
install -d -m 0700 /opt/urumi/private

secrets=/opt/urumi/private/platform-secrets.env
if [[ ! -e "$secrets" ]]; then
  {
    printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 24)"
    printf 'GATEWAY_ENCRYPTION_KEY=%s\n' "$(openssl rand -base64 32)"
    printf 'ADMIN_PASSWORD=%s\n' "$(openssl rand -hex 16)"
    printf 'MCP_UPSTREAM_TOKEN=%s\n' "$(openssl rand -hex 32)"
    printf 'UTILS_MCP_API_KEY=%s\n' "$(openssl rand -hex 24)"
    printf 'WOOCOMMERCE_CONSUMER_KEY=ck_%s\n' "$(openssl rand -hex 20)"
    printf 'WOOCOMMERCE_CONSUMER_SECRET=cs_%s\n' "$(openssl rand -hex 20)"
    printf 'STORE_ADMIN_USER=admin\nSTORE_ADMIN_EMAIL=%s\n' "$admin_email"
    printf 'STORE_ADMIN_PASSWORD=%s\n' "$(openssl rand -hex 16)"
    printf 'MYSQL_PASSWORD=%s\n' "$(openssl rand -hex 24)"
    printf 'MYSQL_ROOT_PASSWORD=%s\n' "$(openssl rand -hex 24)"
  } > "$secrets"
fi
# File is generated locally by this script; values are shell-safe random strings.
source "$secrets"
for ns in urumi urumi-platform; do
  kubectl create namespace "$ns" --dry-run=client -o yaml | kubectl apply -f -
done

apply_secret() {
  local ns=$1 name=$2
  shift 2
  kubectl -n "$ns" create secret generic "$name" "$@" --dry-run=client -o yaml | kubectl apply -f -
}
apply_secret urumi store-database --from-literal="mysql-password=$MYSQL_PASSWORD" --from-literal="mysql-root-password=$MYSQL_ROOT_PASSWORD"
apply_secret urumi store-setup --from-literal="admin-user=$STORE_ADMIN_USER" \
  --from-literal="admin-password=$STORE_ADMIN_PASSWORD" --from-literal="admin-email=$STORE_ADMIN_EMAIL" \
  --from-literal="consumer-key=$WOOCOMMERCE_CONSUMER_KEY" --from-literal="consumer-secret=$WOOCOMMERCE_CONSUMER_SECRET"
gateway_args=(--from-literal="POSTGRES_PASSWORD=$POSTGRES_PASSWORD" --from-literal="GATEWAY_ENCRYPTION_KEY=$GATEWAY_ENCRYPTION_KEY" --from-literal="ADMIN_PASSWORD=$ADMIN_PASSWORD")
# An optional file contains only LLM_API_KEY, not any local database or account credentials.
if [[ -s /opt/urumi/private/llm.env ]]; then
  while IFS='=' read -r key value; do
    if [[ "$key" == LLM_API_KEY && -n "$value" ]]; then
      gateway_args+=(--from-literal="LLM_API_KEY=$value")
    fi
  done < /opt/urumi/private/llm.env
fi
apply_secret urumi-platform gateway "${gateway_args[@]}"
apply_secret urumi-platform woo-mcp --from-literal="WOOCOMMERCE_CONSUMER_KEY=$WOOCOMMERCE_CONSUMER_KEY" \
  --from-literal="WOOCOMMERCE_CONSUMER_SECRET=$WOOCOMMERCE_CONSUMER_SECRET" --from-literal="MCP_UPSTREAM_TOKEN=$MCP_UPSTREAM_TOKEN"
apply_secret urumi-platform utils-mcp --from-literal="UTILS_MCP_API_KEY=$UTILS_MCP_API_KEY"

# K3s' packaged Traefik owns ports 80/443. ACME state survives Traefik Pod replacement.
cat > /var/lib/rancher/k3s/server/manifests/traefik-acme.yaml <<'YAML'
apiVersion: helm.cattle.io/v1
kind: HelmChartConfig
metadata:
  name: traefik
  namespace: kube-system
spec:
  valuesContent: |-
    updateStrategy:
      rollingUpdate:
        maxSurge: 0
        maxUnavailable: 1
    persistence:
      enabled: true
      size: 1Gi
      path: /data
    additionalArguments:
      - --certificatesresolvers.letsencrypt.acme.storage=/data/acme.json
      - --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web
    ports:
      web:
        redirections:
          entryPoint:
            to: websecure
            scheme: https
YAML
kubectl apply -f /var/lib/rancher/k3s/server/manifests/traefik-acme.yaml
# Wait for the packaged chart controller before creating certificate-bearing Ingresses.
for attempt in {1..90}; do
  if kubectl -n kube-system get deployment traefik -o jsonpath='{.spec.template.spec.containers[0].args}' | grep -q 'acme.storage=/data/acme.json'; then
    break
  fi
  sleep 2
done
kubectl -n kube-system get deployment traefik -o jsonpath='{.spec.template.spec.containers[0].args}' | grep -q 'acme.storage=/data/acme.json'
kubectl -n kube-system rollout status deployment/traefik --timeout=180s

cat > /opt/urumi/private/store-values.yaml <<YAML
existingSecret: store-database
persistence:
  storageClass: local-path
  mysqlSize: 10Gi
  wordpressSize: 5Gi
ingress:
  host: ${store_host}
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
    traefik.ingress.kubernetes.io/router.tls.certresolver: letsencrypt
setup:
  existingSecret: store-setup
  url: https://${store_host}
YAML

cat > /opt/urumi/private/platform-values.yaml <<YAML
publicUrl: https://${gateway_host}
timezone: Asia/Kolkata
persistence:
  storageClass: local-path
gateway:
  image: urumi/gateway:${tag}
  adminEmail: ${admin_email}
dashboard:
  image: urumi/dashboard:${tag}
upstreams:
  woo:
    image: urumi/woo-mcp:${tag}
  utils:
    image: urumi/utils-mcp:${tag}
  everything:
    image: urumi/everything-mcp:${tag}
ingress:
  host: ${gateway_host}
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
    traefik.ingress.kubernetes.io/router.tls.certresolver: letsencrypt
YAML

helm lint charts/store -f /opt/urumi/private/store-values.yaml
helm lint charts/platform -f /opt/urumi/private/platform-values.yaml
helm upgrade --install store charts/store -n urumi -f /opt/urumi/private/store-values.yaml --wait --timeout 12m
helm upgrade --install platform charts/platform -n urumi-platform -f /opt/urumi/private/platform-values.yaml --wait --timeout 8m
kubectl -n urumi get pods,jobs,pvc
kubectl -n urumi-platform get pods,ingress,pvc
printf 'Gateway: https://%s\nStore: https://%s\n' "$gateway_host" "$store_host"
echo 'Passwords were saved privately in /opt/urumi/private/platform-secrets.env; not printed.'
