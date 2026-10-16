$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
$previousCache = $env:UV_CACHE_DIR
try {
    $env:UV_CACHE_DIR = Join-Path $projectRoot '.cache/uv'
    & uv venv --python 3.14 --allow-existing .venv-graphify
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el entorno de Graphify.' }
    # Smart App Control blocks the venv launcher, so uv inspects the base
    # interpreter and installs straight into the venv site-packages.
    $basePython = & uv python find 3.14 --system
    if ($LASTEXITCODE -ne 0 -or -not $basePython) { throw 'No se encontro Python 3.14 para Graphify.' }
    & uv pip install --python $basePython --target .venv-graphify/Lib/site-packages -r requirements-graphify.txt
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo instalar Graphify.' }
    Write-Host 'Graphify listo. Ejecuta .\graphify.ps1 --help'
} finally {
    $env:UV_CACHE_DIR = $previousCache
    Pop-Location
}
