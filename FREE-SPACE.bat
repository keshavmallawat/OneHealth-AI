@echo off
REM OneHealth AI - disk audit and safe cleanup.
REM Requests administrator rights (needed for the Windows component-store cleanup).
cd /d "%~dp0"
net session >nul 2>&1
if %errorLevel% == 0 (
  powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\free-space.ps1"
  echo.
  echo Report: scripts\disk-report.txt
  pause
) else (
  echo Requesting administrator rights - please approve the Windows prompt...
  powershell -NoProfile -Command "Start-Process -FilePath powershell.exe -Verb RunAs -ArgumentList '-ExecutionPolicy','Bypass','-NoProfile','-NoExit','-File','\"%~dp0scripts\free-space.ps1\"'"
)
