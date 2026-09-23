@echo off
REM Read-only git audit. Changes nothing. Do not run as administrator.
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\git-audit.ps1"
echo.
echo Report: scripts\git-audit.txt
pause
