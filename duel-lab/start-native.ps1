$ErrorActionPreference = 'Stop'
$astraRoot = $PSScriptRoot
$astraClientRoot = Join-Path $astraRoot 'runtime\MDPro3-client'
$astraExe = Join-Path $astraClientRoot 'MDPro3.exe'
if (-not (Test-Path -LiteralPath $astraExe)) { throw 'MDPro3クライアントを先にビルドしてください。' }
if (Get-NetTCPConnection -LocalPort 8788 -State Listen -ErrorAction SilentlyContinue) {
    throw 'Astra接続が既に起動しています。先に起動した対戦画面を確認してください。'
}
$astraNode = (Get-Command node.exe -ErrorAction Stop).Source
$astraBridge = Start-Process -FilePath $astraNode -ArgumentList ('"' + (Join-Path $astraRoot 'native-bridge.mjs') + '"') -WorkingDirectory $astraRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $astraRoot 'runtime\native-astra.log') -RedirectStandardError (Join-Path $astraRoot 'runtime\native-astra-error.log')
try {
    $astraReady = $false
    for ($i = 0; $i -lt 40; $i++) {
        $astraBridge.Refresh()
        if ($astraBridge.HasExited) { throw 'Astra接続を開始できませんでした。runtime\native-astra-error.logを確認してください。' }
        if (Get-NetTCPConnection -LocalPort 8788 -State Listen -ErrorAction SilentlyContinue) { $astraReady = $true; break }
        Start-Sleep -Milliseconds 250
    }
    if (-not $astraReady) { throw 'Astra接続の起動がタイムアウトしました。' }
    $env:ASTRA_BRIDGE_CONFIG = Join-Path $astraRoot 'runtime\astra-bridge.json'
    $astraClient = Start-Process -FilePath $astraExe -WorkingDirectory $astraClientRoot -ArgumentList ('-logFile "' + (Join-Path $astraRoot 'runtime\native-client.log') + '"') -WindowStyle Normal -PassThru
    Wait-Process -Id $astraClient.Id
} finally {
    $astraBridge.Refresh()
    if (-not $astraBridge.HasExited) { & taskkill /PID $astraBridge.Id /T /F | Out-Null }
    Remove-Item -LiteralPath (Join-Path $astraRoot 'runtime\astra-bridge.json') -Force -ErrorAction SilentlyContinue
}
