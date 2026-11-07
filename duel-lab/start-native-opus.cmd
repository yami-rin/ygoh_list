@echo off
set ASTRA_MODEL=claude-opus-5-5
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-native.ps1"
if errorlevel 1 pause
