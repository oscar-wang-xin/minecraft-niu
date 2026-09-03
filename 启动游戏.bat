@echo off
title Minecraft
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 goto NONPM
if exist node_modules goto RUN
echo First run: installing dependencies...
call npm install
if errorlevel 1 goto FAIL

:RUN
echo Starting server, browser will open http://localhost:5173
echo Close this window to stop the game.
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:5173"
call npx vite --port 5173 --strictPort
goto END

:NONPM
echo [Error] npm not found. Please install Node.js first.
pause
exit /b 1

:FAIL
echo [Error] npm install failed. Check your network and retry.
pause
exit /b 1

:END
pause
