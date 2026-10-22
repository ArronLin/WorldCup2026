param()
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$stateDir = if ($env:OPENSPEC_STUDIO_STATE) { $env:OPENSPEC_STUDIO_STATE } elseif ($env:SPECKIT_WIZARD_STATE) { Join-Path $env:SPECKIT_WIZARD_STATE 'openspec' } else { Join-Path $env:LOCALAPPDATA 'RepoSDDStudio-OpenSpec' }
$runtimeFile = Join-Path $stateDir 'runtime.json'
if (-not (Test-Path -LiteralPath $runtimeFile -PathType Leaf)) { throw 'Open Repo SDD Studio OpenSpec to configure this machine.' }
$runtime = Get-Content -LiteralPath $runtimeFile -Raw -Encoding UTF8 | ConvertFrom-Json
$program = [string]$runtime.command
if (-not (Test-Path -LiteralPath $program -PathType Leaf)) { throw 'The OpenSpec Studio runtime moved; open it again to repair binding.' }
$launchArgs = @($runtime.args) + @('--mcp-bridge', '--project', $repoRoot)
& $program @launchArgs
exit $LASTEXITCODE
