param([Parameter(ValueFromRemainingArguments=$true)][string[]]$ReportArguments)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$stateDir = if ($env:SPECKIT_WIZARD_STATE) { $env:SPECKIT_WIZARD_STATE } else { Join-Path $env:LOCALAPPDATA 'SpecKitWizard' }
$runtimeFile = Join-Path $stateDir 'runtime.json'
if (-not (Test-Path -LiteralPath $runtimeFile -PathType Leaf)) { throw '本机运行时未绑定。打开 Repo SDD Studio 修复，或使用 Python CLI。' }
$runtime = Get-Content -LiteralPath $runtimeFile -Raw -Encoding UTF8 | ConvertFrom-Json
$program = [string]$runtime.command
if (-not (Test-Path -LiteralPath $program -PathType Leaf)) { throw '本机运行时已移动，请重新打开 Studio 修复绑定。' }
$launchArgs = @($runtime.args) + @('--task-workflow') + @($ReportArguments) + @('--project', $repoRoot, '--config', (Join-Path $PSScriptRoot '../reporting/config.json'))
& $program @launchArgs
exit $LASTEXITCODE
