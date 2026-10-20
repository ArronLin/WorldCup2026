#Requires -Version 3.0
<#
  WorldCup2026 one-click launcher (target of the Desktop shortcut).

  - starts the Vite dev server if port $port is not listening
  - waits until it answers, then opens the app in the default browser
  - idempotent: if the server is already up it only opens a browser tab

  Stop the dev server by closing the minimized "vite" console window.

  ASCII only on purpose: PS 5.1 reads a BOM-less .ps1 in the OEM codepage,
  so any CJK in this file would turn into mojibake.
#>
$ErrorActionPreference = 'Stop'

$proj  = 'D:\GitHub\WorldCup2026'
$node  = 'C:\Users\admin\.workbuddy-ai\binaries\node\versions\22.22.2-6\node.exe'
$vite  = Join-Path $proj 'node_modules\vite\bin\vite.js'
$port  = 5173
$url   = "http://127.0.0.1:$port/"
$ready = 90   # seconds

function Show-Failure([string]$message) {
    Write-Host "[WorldCup2026] ERROR: $message"
    try {
        Add-Type -AssemblyName PresentationFramework
        [System.Windows.MessageBox]::Show($message, 'WorldCup2026') | Out-Null
    } catch {
        Start-Sleep -Seconds 8
    }
    exit 1
}

if (-not (Test-Path -LiteralPath $node)) { $node = 'node' }
if (-not (Test-Path -LiteralPath $vite)) {
    Show-Failure "Vite not found at:`n$vite`n`nRun 'npm install' inside $proj first."
}

$alreadyUp = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue).Count -gt 0

if ($alreadyUp) {
    Write-Host "[WorldCup2026] already listening on port $port"
} else {
    Write-Host "[WorldCup2026] starting Vite dev server on port $port ..."
    try {
        Start-Process -FilePath $node `
                      -ArgumentList @($vite, '--port', "$port", '--strictPort', '--host', '127.0.0.1') `
                      -WorkingDirectory $proj -WindowStyle Minimized | Out-Null
    } catch {
        Show-Failure "could not start the dev server.`n$_"
    }

    # Never route 127.0.0.1 through the corporate / sandbox proxy.
    $client = New-Object System.Net.WebClient
    $client.Proxy = $null

    $seconds = 0
    while ($seconds -lt $ready) {
        Start-Sleep -Seconds 1
        $seconds++
        try {
            $null = $client.DownloadString($url)
            Write-Host "[WorldCup2026] server ready after $seconds s"
            $serverUp = $true
            break
        } catch {
            if ($seconds % 10 -eq 0) {
                Write-Host "[WorldCup2026] still waiting ($seconds s) ..."
            }
        }
    }
    if (-not $serverUp) { Show-Failure "server did not answer on $url within $ready seconds.`n`nCheck the minimized console window for the Vite error." }
}

Write-Host "[WorldCup2026] opening $url"
try {
    Start-Process $url | Out-Null
} catch {
    Write-Host "[WorldCup2026] WARNING: server is up but the browser did not open. Visit $url manually."
}
exit 0
