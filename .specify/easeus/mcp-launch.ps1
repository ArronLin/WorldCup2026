param([switch]$Check)
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$runtime = Join-Path $PSScriptRoot 'knowledge-runtime\v1\run.py'
$configuration = Join-Path $PSScriptRoot 'knowledge-runtime.json'
if (-not (Test-Path -LiteralPath $runtime -PathType Leaf)) { throw '仓库知识库运行组件缺失，请从可信源恢复本仓库的受管文件。' }
function Test-PythonVersion([string]$Command, [string[]]$PrefixArgs) {
    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) { return $false }
    & $Command @PrefixArgs '-c' 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 1>$null 2>$null
    return $LASTEXITCODE -eq 0
}
$program = $null
$prefixArgs = @()
if ($env:REPO_SDD_PYTHON) {
    if (Test-PythonVersion $env:REPO_SDD_PYTHON @()) { $program = $env:REPO_SDD_PYTHON }
} elseif (Test-PythonVersion 'python' @()) {
    $program = 'python'
} elseif (Test-PythonVersion 'py' @('-3')) {
    $program = 'py'; $prefixArgs = @('-3')
}
if (-not $program) { throw '需要 Python 3.10 或更新版本。请安装 Python 并加入 PATH，或设置 REPO_SDD_PYTHON 指向解释器。' }
$args = @($runtime, '--config', $configuration, '--root', $repoRoot)
if ($Check) { $args += '--check' }
& $program @prefixArgs @args
exit $LASTEXITCODE
