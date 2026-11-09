@echo off
rem Starts the duel bridge and MDPro3. Closing MDPro3 also stops the bridge.
start "" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0tools\play.ps1"
