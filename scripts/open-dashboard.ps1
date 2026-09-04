$projectRoot = Split-Path -Parent $PSScriptRoot
$startMonitor = Join-Path $PSScriptRoot "start-monitor.ps1"
$frontendRoot = Join-Path $projectRoot "frontend"
$frontendIndex = Join-Path $frontendRoot "dist\index.html"
$apiUrl = "http://127.0.0.1:8000"

& $startMonitor

$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$env:Path = "$machinePath;$userPath"

if (-not (Test-Path $frontendIndex)) {
    $npm = Get-Command npm.cmd -ErrorAction Stop

    Push-Location $frontendRoot
    try {
        if (-not (Test-Path (Join-Path $frontendRoot "node_modules"))) {
            & $npm.Source install
            if ($LASTEXITCODE -ne 0) {
                throw "Nao foi possivel instalar as dependencias do frontend."
            }
        }

        & $npm.Source run build
        if ($LASTEXITCODE -ne 0) {
            throw "Nao foi possivel compilar o frontend."
        }
    }
    finally {
        Pop-Location
    }
}

function Test-ConsumptionApi {
    try {
        $health = Invoke-RestMethod -Uri "$apiUrl/api/health" -TimeoutSec 1
        return $health.status -eq "ok"
    }
    catch {
        return $false
    }
}

$apiReady = Test-ConsumptionApi

if (-not $apiReady) {
    $portInUse = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
    if ($portInUse) {
        throw "A porta 8000 ja esta sendo usada por outro programa."
    }

    $uv = Get-Command uv -ErrorAction Stop
    Start-Process -FilePath $uv.Source -ArgumentList @(
        "run",
        "--no-sync",
        "uvicorn",
        "medidor_consumo.api:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8000"
    ) -WorkingDirectory $projectRoot -WindowStyle Hidden

    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 250
        if (Test-ConsumptionApi) {
            $apiReady = $true
            break
        }
    }
}

if (-not $apiReady) {
    throw "A API nao iniciou dentro do tempo esperado."
}

Start-Process $apiUrl
