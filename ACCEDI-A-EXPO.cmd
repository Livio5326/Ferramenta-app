@echo off
setlocal
set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
cd /d "%~dp0frontend"

echo Accesso all'account Expo
echo.
call node_modules\.bin\expo.cmd login
if errorlevel 1 (
  echo.
  echo Accesso non riuscito.
  pause
  exit /b 1
)

echo.
echo Account Expo collegato:
call node_modules\.bin\expo.cmd whoami
echo.
pause
