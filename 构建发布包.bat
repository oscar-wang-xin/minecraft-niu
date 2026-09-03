@echo off
title Minecraft Build
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 goto NONPM
echo Building production files...
call npm run build
if errorlevel 1 goto FAIL
echo Packing dist.zip ...
powershell -NoProfile -Command "Compress-Archive -Path 'dist\*' -DestinationPath 'dist.zip' -Force"
if errorlevel 1 goto FAIL
echo.
echo Done! Upload dist.zip to your server (BT panel: Files - Upload).
goto END

:NONPM
echo [Error] npm not found. Please install Node.js first.
pause
exit /b 1

:FAIL
echo [Error] Build failed. See messages above.
pause
exit /b 1

:END
pause
