$ErrorActionPreference = 'Stop'

$desktop = [Environment]::GetFolderPath('Desktop')
$lnkPath = Join-Path $desktop 'WorldCup2026.lnk'

$launcher = 'D:\GitHub\WorldCup2026\scripts\start-dev.ps1'
if (-not (Test-Path $launcher)) { throw "launcher not found: $launcher" }

$ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
if (-not (Test-Path $ps)) { throw "powershell.exe not found at $ps" }

$log = @()
$log += "Desktop : $desktop"
$log += "Shortcut: $lnkPath"
$log += "Launcher: $launcher"

$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($lnkPath)
$sc.TargetPath  = $ps
$sc.Arguments   = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcher`""
$sc.WorkingDirectory = 'D:\GitHub\WorldCup2026'
$sc.WindowStyle = 7
$sc.Description = 'WorldCup2026: start the dev server if needed, then open the app in the browser'
$sc.IconLocation = 'C:\Users\admin\.workbuddy-ai\binaries\node\versions\22.22.2-6\node.exe,0'
$sc.Save()

$log += '--- saved, re-reading ---'
$check = $ws.CreateShortcut($lnkPath)
$log += "TargetPath       = $($check.TargetPath)"
$log += "Arguments        = $($check.Arguments)"
$log += "WorkingDirectory = $($check.WorkingDirectory)"
$log += "WindowStyle      = $($check.WindowStyle)"
$log += "IconLocation     = $($check.IconLocation)"
$log += "Length           = $((Get-Item $lnkPath).Length) bytes"

$log | Set-Content -Path 'D:\GitHub\WorldCup2026\.lnk-create.log' -Encoding ASCII
Write-Output 'DONE'
