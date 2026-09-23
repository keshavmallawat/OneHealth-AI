@echo off
REM OneHealth AI - set up the project's own local PostgreSQL.
REM Do NOT run this as administrator: PostgreSQL refuses to run elevated on Windows.
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\setup-database.ps1"
echo.
echo Log: scripts\database-log.txt
pause
