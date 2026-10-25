# Azure student demo deployment

This deploys the dashboard, gateway, three MCP servers, PostgreSQL, WordPress/WooCommerce and MySQL to one Ubuntu VM running K3s. It is a single-node demo: VM or disk failure affects the entire application. Local databases and cloud databases are separate.

## Files

- `main.bicep`: VM, SSH restriction, virtual network, static public IP and 64 GiB Standard SSD.
- `cloud-init.yaml`: pinned K3s and Helm installation.
- `package-release.ps1`: builds five Linux amd64 images from the current working tree and archives the charts. It excludes local credentials, databases and node_modules from the chart archive.
- `deploy-on-vm.sh`: creates fresh cloud credentials and Helm releases; configures persistent Traefik ACME certificates.
- `.local/azure/`: ignored local authentication state, SSH key, deployment parameters, results and release archives. Never commit this directory.

## Provision and deploy

Use Azure CLI with the intended student subscription selected. Check allowed deployment regions, VM quota, availability and current pricing first. Keep the subscription spending limit enabled. The template accepts `vmSize`, `sshPublicKey`, `adminSourceCidr` (your IPv4 followed by `/32`), and optional `location` parameters.

```powershell
az deployment group validate -g urumi-demo-rg --template-file scripts/azure/main.bicep --parameters '@.local/azure/parameters.json'
az deployment group create -g urumi-demo-rg --name urumi-initial --template-file scripts/azure/main.bicep --parameters '@.local/azure/parameters.json'
./scripts/azure/package-release.ps1 -Tag azure-YOUR_VERSION
```

Wait for `sudo cloud-init status --wait` on the VM. Verify its SSH host key through Azure Run Command before accepting it. Transfer `images.tar` and `release.tar.gz` over SSH, extract the release to `/opt/urumi/release`, then import images with `sudo k3s ctr images import /path/to/images.tar`.

Run as root:

```bash
bash /opt/urumi/release/scripts/azure/deploy-on-vm.sh IMAGE_TAG gateway.PUBLIC_IP.sslip.io store.PUBLIC_IP.sslip.io ADMIN_EMAIL
```

An optional root-readable `/opt/urumi/private/llm.env` containing only `LLM_API_KEY=...` enables chat with the configured model provider. Other credentials are generated fresh in `/opt/urumi/private/platform-secrets.env`. Read passwords privately over SSH; do not paste them into documentation or source control.

## Verify

Check cloud-init success, node Ready, all application Pods Ready, completed store setup Job, bound PVCs, HTTPS certificate validity, dashboard login, upstream health and actual MCP tool discovery. Helm lint and ARM validation alone do not establish that the application works.

Temporary sslip.io hostnames depend on a third-party DNS service and certificate issuance limits. They are suitable for a demo; use your own domain for a maintained deployment.

## Stop and resume costs

```powershell
az vm deallocate -g urumi-demo-rg -n urumi-demo-vm
az vm start -g urumi-demo-rg -n urumi-demo-vm
```

Deallocation stops compute billing but retained disks and public IPv4 still incur charges. Guest shutdown alone is insufficient. The VM size validated on 2026-10-25 was `Standard_B2s_v2` in Korea Central, retail Linux compute US$0.10/hour (US$73 per 730 hours), excluding disk, public IP, tax and other usage. Student credits are finite; this is not a permanently free deployment. Verify current charges in Azure Cost Management.

Back up MySQL, PostgreSQL, WordPress uploads and the gateway encryption key to storage outside the VM before relying on it. A persistent volume is not a backup. Keep an application-consistent database export as well as any disk snapshot. Do not delete the resource group until the data you need has been backed up.

## Updates

Package a new unique image tag, upload/import images, and rerun `deploy-on-vm.sh` with the same hostnames. Existing secrets are reused. Review chart and database migration changes before upgrading. Image import deploys the current working tree; it does not commit or push that code to GitHub and is not automated CI/CD.

References: [Azure retail pricing API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices), [Azure VM cost management](https://learn.microsoft.com/en-us/azure/virtual-machines/cost-optimization-plan-to-manage-costs), [Traefik Kubernetes setup](https://doc.traefik.io/traefik/setup/kubernetes/).
