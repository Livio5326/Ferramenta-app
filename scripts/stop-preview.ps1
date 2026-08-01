$repoRoot = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $repoRoot '.preview-backend.pid'

if (Test-Path -LiteralPath $pidFile) {
    $backendPid = Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue
    if ($backendPid) {
        Stop-Process -Id $backendPid -Force -ErrorAction SilentlyContinue
    }
    Remove-Item -LiteralPath $pidFile -Force
}

Write-Host 'Backend locale arrestato. Chiudi anche la finestra Expo.' -ForegroundColor Yellow
