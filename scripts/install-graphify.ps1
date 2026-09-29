$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
$previousCache = $env:UV_CACHE_DIR
try {
    $env:UV_CACHE_DIR = Join-Path $projectRoot '.cache/uv'
    & uv venv --python 3.14 --allow-existing .venv-graphify
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el entorno de Graphify.' }
    & uv pip install --python .venv-graphify/Scripts/python.exe -r requirements-graphify.txt
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo instalar Graphify.' }
    Write-Host 'Graphify listo. Ejecuta .\graphify.ps1 --help'
} finally {
    $env:UV_CACHE_DIR = $previousCache
    Pop-Location
}
