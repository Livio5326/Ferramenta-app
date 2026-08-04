$repoRoot = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $repoRoot '.preview-backend.pid'

if (Test-Path -LiteralPath $pidFile) {
    $backendPid = Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue
    if ($backendPid) {
        Stop-Process -Id $backendPid -Force -ErrorAction SilentlyContinue
    }
    Remove-Item -LiteralPath $pidFile -Force
}

# Arresta anche Metro/Expo: se resta vivo, al prossimo avvio due bundler
# sorvegliano gli stessi file e le connessioni di debug entrano in conflitto.
$expoFermato = $false
foreach ($porta in @(8081, 19006)) {
    $connessione = Get-NetTCPConnection `
        -LocalPort $porta `
        -State Listen `
        -ErrorAction SilentlyContinue | Select-Object -First 1

    if (-not $connessione) {
        continue
    }

    $processo = Get-Process -Id $connessione.OwningProcess -ErrorAction SilentlyContinue

    if (
        $processo -and
        $processo.ProcessName -eq 'node' -and
        $processo.Path -like '*codex-primary-runtime*'
    ) {
        Stop-Process -Id $processo.Id -Force -ErrorAction SilentlyContinue
        $expoFermato = $true
    }
}

if ($expoFermato) {
    Write-Host 'Backend locale ed Expo arrestati.' -ForegroundColor Yellow
} else {
    Write-Host 'Backend locale arrestato. Nessuna istanza Expo trovata.' -ForegroundColor Yellow
}
