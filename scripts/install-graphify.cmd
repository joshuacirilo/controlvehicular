@echo off
setlocal
pushd "%~dp0.."
set "UV_CACHE_DIR=%CD%\.cache\uv"
uv venv --python 3.14 --allow-existing .venv-graphify
if errorlevel 1 goto failure
uv pip install --python .venv-graphify/Scripts/python.exe -r requirements-graphify.txt
if errorlevel 1 goto failure
popd
exit /b 0
:failure
popd
exit /b 1
