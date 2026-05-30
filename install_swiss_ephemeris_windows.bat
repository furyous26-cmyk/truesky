@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  py -3.11 -m pip install --upgrade pip setuptools wheel
  py -3.11 -m pip install pyswisseph
) else (
  python -m pip install --upgrade pip setuptools wheel
  python -m pip install pyswisseph
)
if not exist ephe mkdir ephe
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0download_required_ephe.ps1"
echo.
echo Pronto. Agora rode: npm install && npm start
pause
