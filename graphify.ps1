# Forward arguments to the project-local Graphify installation.
# Smart App Control blocks the unsigned launchers inside the venv, so run the
# base interpreter recorded in pyvenv.cfg with the venv packages on PYTHONPATH.
$venv = Join-Path $PSScriptRoot '.venv-graphify'
$config = Join-Path $venv 'pyvenv.cfg'
if (-not (Test-Path -LiteralPath $config)) {
    throw 'Graphify no esta instalado. Ejecuta .\scripts\install-graphify.ps1'
}
$homeLine = Get-Content -LiteralPath $config | Where-Object { $_ -match '^\s*home\s*=' } | Select-Object -First 1
$python = Join-Path ($homeLine -replace '^\s*home\s*=\s*', '').Trim() 'python.exe'
if (-not (Test-Path -LiteralPath $python)) {
    throw 'No se encontro el Python base de Graphify. Ejecuta .\scripts\install-graphify.ps1'
}
$previousPythonPath = $env:PYTHONPATH
try {
    $env:PYTHONPATH = Join-Path $venv 'Lib/site-packages'
    & $python -m graphify @args
    $code = $LASTEXITCODE
} finally {
    $env:PYTHONPATH = $previousPythonPath
}
exit $code
