# Forward arguments to the project-local Graphify installation.
$graphifyExecutable = Join-Path $PSScriptRoot '.venv-graphify/Scripts/graphify.exe'
if (-not (Test-Path -LiteralPath $graphifyExecutable)) {
    throw 'Graphify no esta instalado. Ejecuta .\scripts\install-graphify.ps1'
}
& $graphifyExecutable @args
exit $LASTEXITCODE
