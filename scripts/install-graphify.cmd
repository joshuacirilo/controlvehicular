@echo off
setlocal
pushd "%~dp0.."
set "UV_CACHE_DIR=%CD%\.cache\uv"
uv venv --python 3.14 --allow-existing .venv-graphify
if errorlevel 1 goto failure
rem Smart App Control blocks the venv launcher, so uv inspects the base
rem interpreter and installs straight into the venv site-packages.
set "PYBASE="
for /f "delims=" %%P in ('uv python find 3.14 --system') do set "PYBASE=%%P"
if not defined PYBASE goto failure
uv pip install --python "%PYBASE%" --target .venv-graphify\Lib\site-packages -r requirements-graphify.txt
if errorlevel 1 goto failure
popd
exit /b 0
:failure
popd
exit /b 1
