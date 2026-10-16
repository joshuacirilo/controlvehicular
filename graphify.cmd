@echo off
setlocal
rem Smart App Control blocks the unsigned launchers inside the venv, so run the
rem base interpreter recorded in pyvenv.cfg with the venv packages on PYTHONPATH.
set "VENV=%~dp0.venv-graphify"
if not exist "%VENV%\pyvenv.cfg" (
  echo Graphify no esta instalado. Ejecuta .\scripts\install-graphify.cmd 1>&2
  exit /b 1
)
set "PYHOME="
for /f "tokens=1,* delims==" %%A in ('findstr /b /c:"home" "%VENV%\pyvenv.cfg"') do set "PYHOME=%%B"
for /f "tokens=*" %%C in ("%PYHOME%") do set "PYHOME=%%C"
if not exist "%PYHOME%\python.exe" (
  echo No se encontro el Python base de Graphify. Ejecuta .\scripts\install-graphify.cmd 1>&2
  exit /b 1
)
set "PYTHONPATH=%VENV%\Lib\site-packages"
"%PYHOME%\python.exe" -m graphify %*
exit /b %errorlevel%
