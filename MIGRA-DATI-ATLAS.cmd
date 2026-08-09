@echo off
setlocal
cd /d "%~dp0"
title Migrazione Ferramenta su MongoDB Atlas

if not exist "backend\.venv\Scripts\python.exe" (
  echo ERRORE: ambiente Python locale non trovato.
  pause
  exit /b 1
)

"backend\.venv\Scripts\python.exe" "scripts\migra_dati_atlas.py"
echo.
pause
