@echo off
setlocal
pushd "%~dp0..\appmovil"
set "FLUTTER_BIN=%USERPROFILE%\develop\flutter\bin\flutter.bat"
if not exist "%FLUTTER_BIN%" set "FLUTTER_BIN=flutter"
call "%FLUTTER_BIN%" run -d chrome --web-port 8080
set "APP_EXIT=%errorlevel%"
popd
exit /b %APP_EXIT%
