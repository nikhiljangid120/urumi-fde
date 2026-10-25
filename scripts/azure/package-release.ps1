param([string]$Tag = ('azure-' + (Get-Date -Format 'yyyyMMdd-HHmmss')))
$ErrorActionPreference = 'Stop'
if ($Tag -notmatch '^[a-zA-Z0-9._-]+$') { throw 'Invalid image tag.' }
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Push-Location $projectRoot
try {
    $out = Join-Path $projectRoot '.local/azure'
    New-Item -ItemType Directory -Force -Path $out | Out-Null
    & docker info --format '{{.ServerVersion}}'
    if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop before packaging.' }
    $images = [ordered]@{
        gateway = 'apps/gateway'
        dashboard = 'apps/dashboard'
        'woo-mcp' = 'apps/woocommerce-mcp'
        'utils-mcp' = 'apps/utils-mcp'
        'everything-mcp' = 'apps/everything-mcp'
    }
    $names = @()
    foreach ($image in $images.Keys) {
        $name = "urumi/${image}:$Tag"
        & docker build --platform linux/amd64 -t $name $images[$image]
        if ($LASTEXITCODE -ne 0) { throw "Image build failed: $image" }
        $names += $name
    }
    & docker save -o (Join-Path $out 'images.tar') @names
    if ($LASTEXITCODE -ne 0) { throw 'Image export failed.' }
    & tar -czf (Join-Path $out 'release.tar.gz') charts scripts/azure/deploy-on-vm.sh
    if ($LASTEXITCODE -ne 0) { throw 'Chart archive failed.' }
    Set-Content -Path (Join-Path $out 'image-tag.txt') -Value $Tag
    Get-FileHash (Join-Path $out 'images.tar'), (Join-Path $out 'release.tar.gz') -Algorithm SHA256
} finally { Pop-Location }
