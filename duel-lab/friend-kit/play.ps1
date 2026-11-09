# Friend kit launcher (copied to tools\play.ps1 in the kit; started by 遊ぶ.bat).
# Starts duel-bridge.ps1 hidden, runs MDPro3 from the kit folder and stops the bridge when MDPro3 exits.
param(
  [int]$LocalPort = 7911,
  [string]$GameArguments = ''
)
$ErrorActionPreference = 'Stop'
$kitRoot = Split-Path -Parent $PSScriptRoot
$gameExe = Join-Path $kitRoot 'MDPro3.exe'
$bridgeScript = Join-Path $PSScriptRoot 'duel-bridge.ps1'

function Show-KitError([string]$text) {
  Add-Type -AssemblyName System.Windows.Forms
  [void][System.Windows.Forms.MessageBox]::Show($text, 'MDPro3 オリカ対戦', 'OK', 'Error')
}

function Test-Listening([int]$port) {
  $listeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
  return [bool]($listeners | Where-Object { $_.Port -eq $port })
}

try {
  if (-not (Test-Path -LiteralPath $gameExe)) {
    throw 'MDPro3.exe が見つかりません。zip をすべて展開してから、展開したフォルダーの「遊ぶ.bat」を起動してください。'
  }
  # A bridge of this kit left over from a forced shutdown would hold the port.
  $leftovers = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
    Where-Object { $_.CommandLine -and $_.CommandLine.Contains($bridgeScript) }
  foreach ($old in $leftovers) { Stop-Process -Id $old.ProcessId -Force -ErrorAction SilentlyContinue }
  if ($leftovers) { Start-Sleep -Milliseconds 500 }
  if (Test-Listening $LocalPort) {
    throw "ポート $LocalPort が他のアプリで使われています。MDPro3 が既に起動していないか確認してください。"
  }

  $bridgeArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden',
    '-File', ('"' + $bridgeScript + '"'), '-LocalPort', $LocalPort)
  $bridge = Start-Process -FilePath 'powershell.exe' -ArgumentList $bridgeArgs -WindowStyle Hidden -PassThru
  try {
    $ready = $false
    for ($i = 0; $i -lt 75; $i++) {
      if ($bridge.HasExited) { break }
      if (Test-Listening $LocalPort) { $ready = $true; break }
      Start-Sleep -Milliseconds 200
    }
    if (-not $ready) { throw '中継を起動できませんでした。もう一度「遊ぶ.bat」を起動してください。' }

    if ($GameArguments) {
      $game = Start-Process -FilePath $gameExe -WorkingDirectory $kitRoot -ArgumentList $GameArguments -PassThru
    } else {
      $game = Start-Process -FilePath $gameExe -WorkingDirectory $kitRoot -PassThru
    }
    $game.WaitForExit()
  } finally {
    $bridge.Refresh()
    if (-not $bridge.HasExited) { Stop-Process -Id $bridge.Id -Force -ErrorAction SilentlyContinue }
  }
} catch {
  Show-KitError $_.Exception.Message
}
