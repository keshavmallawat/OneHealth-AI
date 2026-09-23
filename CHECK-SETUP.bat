@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\diagnose.ps1"
echo.
echo Results written to scripts\diagnostics.txt
pause
