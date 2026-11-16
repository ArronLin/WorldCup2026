param([Parameter(ValueFromRemainingArguments=$true)][string[]]$WorkflowArguments)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$entry = Join-Path $PSScriptRoot 'runtime.py'
if (-not (Test-Path -LiteralPath $entry -PathType Leaf)) { throw '仓库任务组件缺失，请重新部署受管组件。' }
$candidates = @()
if ($env:REPO_SDD_PYTHON) { $candidates += ,@($env:REPO_SDD_PYTHON) }
$candidates += ,@('py', '-3')
$candidates += ,@('python')
$candidates += ,@('python3')
$selected = $null
foreach ($candidate in $candidates) {
    $program = $candidate[0]
    if (-not (Get-Command $program -ErrorAction SilentlyContinue)) { continue }
    $prefix = @($candidate | Select-Object -Skip 1)
    & $program @prefix -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)' 2>$null
    if ($LASTEXITCODE -eq 0) { $selected = $candidate; break }
}
if (-not $selected) { throw '需要 Python 3.10 或更新版本。安装 Python 后确认 py -3 或 python 可用，也可设置 REPO_SDD_PYTHON 指向解释器。' }
$prefix = @($selected | Select-Object -Skip 1)
$program = $selected[0]
& $program @prefix -B $entry @WorkflowArguments --project $repoRoot --rules (Join-Path $PSScriptRoot '..\requirements.json')
exit $LASTEXITCODE
