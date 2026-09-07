$ErrorActionPreference = 'Stop'
$astraRoot = $PSScriptRoot
$astraPython = 'C:\Users\tofu\.local\bin\python.exe'
if (-not (Test-Path -LiteralPath $astraPython)) { throw 'Pythonの実体パスをbuild-native.ps1に設定してください。' }
& $astraPython (Join-Path $astraRoot 'scripts\setup-native.py')
if ($LASTEXITCODE -ne 0) { throw 'MDPro3のセットアップに失敗しました。' }
$astraSource = Join-Path $astraRoot 'runtime\MDPro3'
$astraClient = Join-Path $astraRoot 'runtime\MDPro3-client'
New-Item -ItemType Directory -Force -Path $astraClient | Out-Null
$env:ASTRA_BUILD_OUTPUT = Join-Path $astraClient 'MDPro3.exe'
$astraEditor = Join-Path $astraRoot 'runtime\unity-6000.0.24\Editor\Unity.exe'
$astraLog = Join-Path $astraRoot 'runtime\unity-build.log'
$astraArgs = '-batchmode -quit -projectPath "' + $astraSource + '" -executeMethod BuildAstra.Build -logFile "' + $astraLog + '"'
$astraBuild = Start-Process -FilePath $astraEditor -ArgumentList $astraArgs -WindowStyle Hidden -Wait -PassThru
if ($astraBuild.ExitCode -ne 0) { throw ('ビルドに失敗しました: ' + $astraLog) }
& $astraPython (Join-Path $astraRoot 'scripts\stage-mdpro3.py')
if ($LASTEXITCODE -ne 0) { throw 'クライアントデータの配置に失敗しました。' }
Write-Host 'ビルド完了。start-native.cmdで起動できます。'
