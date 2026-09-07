$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath 'node_modules/ocgcore-wasm')) {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
}
if (-not (Test-Path -LiteralPath 'data/cards.json')) {
    & 'C:\Users\tofu\.local\bin\python.exe' scripts/setup.py
    if ($LASTEXITCODE -ne 0) { throw 'Card data setup failed' }
}
$duelPort = if ($env:DUEL_PORT) { $env:DUEL_PORT } else { '8787' }
$duelUrl = "http://127.0.0.1:$duelPort"
$duelRunning = $false
try {
    $duelHealth = Invoke-RestMethod "$duelUrl/api/config" -TimeoutSec 2
    $duelRunning = $duelHealth.model -eq 'gpt-6-astra'
} catch { }
if (-not $duelRunning) {
    New-Item -ItemType Directory -Path runtime -Force | Out-Null
    $duelNode = (Get-Command node).Source
    $duelProc = Start-Process -FilePath $duelNode -ArgumentList 'server.mjs' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput "$PSScriptRoot/runtime/server.log" -RedirectStandardError "$PSScriptRoot/runtime/server-error.log" -PassThru
    $duelProc.Id | Set-Content runtime/server.pid
    for ($duelAttempt = 0; $duelAttempt -lt 20; $duelAttempt++) {
        Start-Sleep -Milliseconds 500
        try { $null = Invoke-RestMethod "$duelUrl/api/config" -TimeoutSec 2; $duelRunning = $true; break } catch { }
    }
    if (-not $duelRunning) { throw 'Server did not start. See runtime/server-error.log' }
}
Start-Process $duelUrl
