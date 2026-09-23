@echo off
REM Start ONLY the Vite frontend and verify it. Does not touch the database,
REM the backend or the AI service. Do not run as administrator.
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\start-frontend.ps1"
echo.
echo Result written to scripts\frontend-check.txt
pause
