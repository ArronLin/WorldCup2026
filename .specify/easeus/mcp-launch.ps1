param()
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$stateDir = if ($env:SPECKIT_WIZARD_STATE) { $env:SPECKIT_WIZARD_STATE } else { Join-Path $env:LOCALAPPDATA 'SpecKitWizard' }
$runtimeFile = Join-Path $stateDir 'runtime.json'
if (-not (Test-Path -LiteralPath $runtimeFile -PathType Leaf)) { throw 'Run Spec Kit Repo Wizard to configure this repository on this machine.' }
$runtime = Get-Content -LiteralPath $runtimeFile -Raw -Encoding UTF8 | ConvertFrom-Json
$program = [string]$runtime.command
if (-not (Test-Path -LiteralPath $program -PathType Leaf)) { throw 'The wizard program moved. Open it again to repair the local runtime binding.' }
$launchArgs = @($runtime.args) + @('--mcp-bridge', '--project', $repoRoot)
& $program @launchArgs
exit $LASTEXITCODE
