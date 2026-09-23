@echo off
REM OneHealth AI - one-click setup, build, test and start.
REM Double-click this file, or run it from a terminal.
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\setup-and-verify.ps1"
echo.
echo ==========================================================
echo Finished. Full log: scripts\setup-log.txt
echo Frontend: http://localhost:5173
echo ==========================================================
pause
