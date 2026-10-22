param([Parameter(ValueFromRemainingArguments=$true)][string[]]$ReportArguments)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$stateDir = if ($env:OPENSPEC_STUDIO_STATE) { $env:OPENSPEC_STUDIO_STATE } elseif ($env:SPECKIT_WIZARD_STATE) { Join-Path $env:SPECKIT_WIZARD_STATE 'openspec' } else { Join-Path $env:LOCALAPPDATA 'RepoSDDStudio-OpenSpec' }
$runtimeFile = Join-Path $stateDir 'runtime.json'
if (-not (Test-Path -LiteralPath $runtimeFile -PathType Leaf)) { throw '本机运行时未绑定。打开 Repo SDD Studio 修复，或使用 Python CLI。' }
$runtime = Get-Content -LiteralPath $runtimeFile -Raw -Encoding UTF8 | ConvertFrom-Json
$program = [string]$runtime.command
if (-not (Test-Path -LiteralPath $program -PathType Leaf)) { throw '本机运行时已移动，请重新打开 Studio 修复绑定。' }
$launchArgs = @($runtime.args) + @('--feature-report') + @($ReportArguments) + @('--project', $repoRoot, '--config', (Join-Path $PSScriptRoot 'config.json'))
& $program @launchArgs
exit $LASTEXITCODE
