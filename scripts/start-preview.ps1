$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $repoRoot 'frontend'
$backendDir = Join-Path $repoRoot 'backend'
$backendEnv = Join-Path $backendDir '.env'
$runtimeRoot = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'
$nodeBin = Join-Path $runtimeRoot 'node\bin'
$pythonExe = Join-Path $backendDir '.venv\Scripts\python.exe'
$expoCmd = Join-Path $frontendDir 'node_modules\.bin\expo.cmd'

if (-not (Test-Path -LiteralPath $pythonExe)) {
    throw 'Backend locale non configurato: manca backend\.venv.'
}
if (-not (Test-Path -LiteralPath $backendEnv)) {
    throw 'Backend non configurato: manca backend\.env con MONGO_URL, DB_NAME e JWT_SECRET.'
}
if (-not (Test-Path -LiteralPath $expoCmd)) {
    throw 'Frontend non configurato: manca frontend\node_modules.'
}

$localIp = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
    Where-Object {
        $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
        -not $_.IPAddressToString.StartsWith('127.')
    } |
    ForEach-Object { $_.IPAddressToString } |
    Select-Object -First 1
if (-not $localIp) {
    throw 'Impossibile trovare l’indirizzo IPv4 della rete locale.'
}

# Il backend carica MONGO_URL, DB_NAME e JWT_SECRET dal proprio file .env.
# Non impostarli qui: l'anteprima deve usare gli stessi utenti e dati reali.
$ready = $false
try {
    $existingBackend = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 2
    $ready = $existingBackend.status -eq 'ok'
} catch {
    $ready = $false
}

if (-not $ready) {
    $backendProcess = Start-Process -FilePath $pythonExe `
        -ArgumentList '-m', 'uvicorn', 'server:app', '--host', '0.0.0.0', '--port', '8000' `
        -WorkingDirectory $backendDir `
        -WindowStyle Hidden `
        -PassThru
    $backendProcess.Id | Set-Content -LiteralPath (Join-Path $repoRoot '.preview-backend.pid')

    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 2 | Out-Null
            $ready = $true
            break
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
}
if (-not $ready) {
    if ($backendProcess) {
        Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    throw 'Il backend locale non si è avviato correttamente.'
}

# Libera la porta di Expo se un precedente avvio e rimasto in esecuzione.
$existingExpo = Get-NetTCPConnection `
    -LocalPort 8081 `
    -State Listen `
    -ErrorAction SilentlyContinue | Select-Object -First 1

if ($existingExpo) {
    $existingExpoProcess = Get-Process `
        -Id $existingExpo.OwningProcess `
        -ErrorAction SilentlyContinue

    if (
        $existingExpoProcess -and
        $existingExpoProcess.ProcessName -eq 'node' -and
        $existingExpoProcess.Path -like '*codex-primary-runtime*'
    ) {
        Stop-Process -Id $existingExpoProcess.Id -Force
        Start-Sleep -Milliseconds 800
    } else {
        throw 'La porta 8081 e occupata da un programma diverso da Expo.'
    }
}

$env:Path = $nodeBin + ';' + $env:Path
$env:EXPO_NO_TELEMETRY = '1'
$env:EXPO_LOCAL_PREVIEW = '1'
Remove-Item Env:EXPO_OFFLINE -ErrorAction SilentlyContinue
$env:EXPO_PUBLIC_BACKEND_URL = "http://${localIp}:8000"
$expoCommand = "& '$expoCmd' start --lan --clear"
Start-Process -FilePath 'powershell.exe' `
    -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $expoCommand `
    -WorkingDirectory $frontendDir

Write-Host ''
Write-Host 'Expo avviato. Attendi il QR nella nuova finestra.' -ForegroundColor Green
Write-Host "Backend telefono: http://${localIp}:8000"
Write-Host 'Scansiona il QR nella finestra Expo con Expo Go.'
