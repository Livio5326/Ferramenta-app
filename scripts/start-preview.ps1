$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $repoRoot 'frontend'
$backendDir = Join-Path $repoRoot 'backend'
$backendEnv = Join-Path $backendDir '.env'
$runtimeRoot = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'
$nodeBin = Join-Path $runtimeRoot 'node\bin'
$pythonExe = Join-Path $backendDir '.venv\Scripts\python.exe'
$expoCmd = Join-Path $frontendDir 'node_modules\.bin\expo.cmd'
$dockerDesktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
$mongoContainer = 'ferramenta-mongo'
$adbExe = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'

if (-not (Test-Path -LiteralPath $pythonExe)) {
    throw 'Backend locale non configurato: manca backend\.venv.'
}
if (-not (Test-Path -LiteralPath $backendEnv)) {
    throw 'Backend non configurato: manca backend\.env con MONGO_URL, DB_NAME e JWT_SECRET.'
}
if (-not (Test-Path -LiteralPath $expoCmd)) {
    throw 'Frontend non configurato: manca frontend\node_modules.'
}

function Test-LocalPort {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $connection = $client.ConnectAsync('127.0.0.1', $Port)
        return $connection.Wait(700) -and $client.Connected
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

if (-not (Test-LocalPort -Port 27017)) {
    $dockerReady = $false
    try {
        docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
        $dockerReady = $LASTEXITCODE -eq 0
    } catch {
        $dockerReady = $false
    }

    if (-not $dockerReady) {
        if (-not (Test-Path -LiteralPath $dockerDesktop)) {
            throw 'MongoDB non e attivo e Docker Desktop non e installato nel percorso previsto.'
        }

        Start-Process -FilePath $dockerDesktop -WindowStyle Hidden
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            try {
                docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    $dockerReady = $true
                    break
                }
            } catch {
                $dockerReady = $false
            }
            Start-Sleep -Seconds 2
        }
    }

    if (-not $dockerReady) {
        throw 'Docker Desktop non si e avviato correttamente.'
    }

    $containerExists = docker container inspect $mongoContainer 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Manca il container MongoDB '$mongoContainer'."
    }

    docker start $mongoContainer | Out-Null
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        if (Test-LocalPort -Port 27017) {
            break
        }
        Start-Sleep -Seconds 1
    }
}

if (-not (Test-LocalPort -Port 27017)) {
    throw 'MongoDB non risponde sulla porta locale 27017.'
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

# Preferisci il cavo USB (adb reverse) al WiFi: il bundle JS pesa ~20 MB e su
# reti WiFi domestiche instabili il download si blocca a meta' (bundling
# fermo a una percentuale fissa). Via USB il traffico non passa dal WiFi.
$useUsb = $false
if (Test-Path -LiteralPath $adbExe) {
    # adb, quando il daemon non e' ancora attivo, scrive "* daemon not running;
    # starting now" su stderr: con $ErrorActionPreference='Stop' PowerShell 5.1
    # lo trasforma in un NativeCommandError che interrompe lo script prima ancora
    # di avviare Expo. Avviamo prima il daemon e leggiamo i device ignorando
    # eventuali errori non fatali di adb.
    try {
        $prevEap = $ErrorActionPreference
        $ErrorActionPreference = 'SilentlyContinue'
        & $adbExe start-server 2>&1 | Out-Null
        $adbDevices = (& $adbExe devices 2>&1) |
            Select-Object -Skip 1 |
            Where-Object { $_ -match '\bdevice$' }
        if ($adbDevices) {
            $useUsb = $true
        }
    } catch {
        $useUsb = $false
    } finally {
        $ErrorActionPreference = $prevEap
    }
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
    # --timeout-keep-alive: di default uvicorn chiude le connessioni inattive
    # dopo 5 secondi. L'app riusa la connessione dal proprio pool e la
    # richiesta finisce nel vuoto finche' non scatta il timeout del client
    # ("Il server non risponde"). 75 secondi stanno oltre le pause tipiche
    # tra una schermata e l'altra.
    $backendProcess = Start-Process -FilePath $pythonExe `
        -ArgumentList '-m', 'uvicorn', 'server:app', '--host', '0.0.0.0', '--port', '8000', '--timeout-keep-alive', '75' `
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

if ($useUsb) {
    & $adbExe reverse tcp:8081 tcp:8081 | Out-Null
    & $adbExe reverse tcp:8000 tcp:8000 | Out-Null
    Remove-Item Env:REACT_NATIVE_PACKAGER_HOSTNAME -ErrorAction SilentlyContinue
    $env:EXPO_PUBLIC_BACKEND_URL = 'http://localhost:8000'
    $expoCommand = "& '$expoCmd' start --dev-client --localhost --clear"
} else {
    $env:REACT_NATIVE_PACKAGER_HOSTNAME = $localIp
    $env:EXPO_PUBLIC_BACKEND_URL = "http://${localIp}:8000"
    $expoCommand = "& '$expoCmd' start --dev-client --lan --clear"
}

Start-Process -FilePath 'powershell.exe' `
    -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $expoCommand `
    -WorkingDirectory $frontendDir

Write-Host ''
if ($useUsb) {
    Write-Host 'Expo avviato in modalita USB (adb reverse): il telefono e collegato via cavo.' -ForegroundColor Green
    Write-Host 'Apri la Development Build sul telefono: si connette da sola, non serve scansionare il QR.'
    Write-Host 'Se non si connette, premi "a" nella finestra Expo per lanciarla sul device Android.'
} else {
    Write-Host 'Nessun device Android su USB rilevato: uso il WiFi (meno affidabile per bundle grandi).' -ForegroundColor Yellow
    Write-Host 'Consiglio: collega il telefono al PC via cavo USB con il debug USB attivo e riavvia per usare adb reverse.'
    Write-Host "Backend telefono: http://${localIp}:8000"
    Write-Host 'Scansiona il QR nella finestra Expo con il Development Build.'
}
