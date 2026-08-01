# pulisci_backend.ps1
# Script per riordinare la cartella backend del progetto Ferramenta.
# Esegui questo script DENTRO la cartella "backend" del tuo progetto.
#
# Cosa fa:
#  1. Crea una cartella "_archivio" e ci sposta dentro tutti i file di
#     backup vecchi e le versioni superate degli script Stanley
#     (NON cancella nulla, solo li sposta fuori dai piedi)
#  2. Cancella "__pycache__" (si rigenera da solo, non serve tenerlo)
#  3. Crea/aggiorna un file .gitignore
#
# Come si usa:
#  1. Apri PowerShell
#  2. Vai nella cartella backend del progetto con: cd "percorso\alla\cartella\backend"
#  3. Esegui: .\pulisci_backend.ps1

Write-Host "=== Pulizia cartella backend ===" -ForegroundColor Cyan

# 1. Crea cartella archivio
$archivio = "_archivio"
if (-not (Test-Path $archivio)) {
    New-Item -ItemType Directory -Path $archivio | Out-Null
    Write-Host "Creata cartella $archivio"
}

# 2. Sposta i file di backup manuali (.backup_*, .bak, .bak2)
$backupFiles = Get-ChildItem -File | Where-Object {
    $_.Name -match '\.backup' -or $_.Name -match '\.bak[0-9]?$'
}
foreach ($f in $backupFiles) {
    Move-Item -Path $f.FullName -Destination $archivio -Force
    Write-Host "Archiviato: $($f.Name)"
}

# 3. Sposta le versioni vecchie di correggi_descrizioni_stanley (tiene solo v7)
$vecchiScript = @(
    "correggi_descrizioni_stanley.py",
    "correggi_descrizioni_stanley_completa.py",
    "correggi_descrizioni_stanley_v3.py",
    "correggi_descrizioni_stanley_v4.py",
    "correggi_descrizioni_stanley_v5.py",
    "correggi_descrizioni_stanley_v6.py"
)
foreach ($f in $vecchiScript) {
    if (Test-Path $f) {
        Move-Item -Path $f -Destination $archivio -Force
        Write-Host "Archiviato: $f"
    }
}

# 4. Sposta i JSON vecchi di stanley (tiene solo v7_completa)
$vecchiJson = @(
    "stanley_correzioni_aggiuntive_v3.json",
    "stanley_correzioni_descrizioni_v4.json",
    "stanley_descrizioni_corrette.json",
    "stanley_descrizioni_pdf_migliorate.json",
    "stanley_descrizioni_v5_da_pdf.json",
    "stanley_descrizioni_v6_mirate.json"
)
foreach ($f in $vecchiJson) {
    if (Test-Path $f) {
        Move-Item -Path $f -Destination $archivio -Force
        Write-Host "Archiviato: $f"
    }
}

# 5. Cancella __pycache__ (si rigenera da solo)
if (Test-Path "__pycache__") {
    Remove-Item -Path "__pycache__" -Recurse -Force
    Write-Host "Cancellato: __pycache__ (si rigenera automaticamente)"
}

# 6. Crea/aggiorna .gitignore
$gitignoreContent = @"
__pycache__/
*.pyc
.env
backups/
uploads/*
!uploads/.gitkeep
_archivio/
*.backup*
*.bak
"@
Set-Content -Path ".gitignore" -Value $gitignoreContent
Write-Host "Creato/aggiornato .gitignore"

Write-Host ""
Write-Host "=== Fatto! ===" -ForegroundColor Green
Write-Host "I file vecchi sono in _archivio (non cancellati, puoi controllarli e poi eliminare la cartella quando vuoi)."
