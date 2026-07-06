@echo off
echo ===================================================
echo   IDexo Desktop Companion Launcher (Dev Mode)
echo ===================================================
echo.

:: Check for NodeJS
node -v >nul 2>&1
if %errorlevel% neq 0 (
  echo Error: Node.js is not installed or not in the PATH.
  echo Please install Node.js from https://nodejs.org/ and try again.
  pause
  exit /b 1
)

echo Starting Electron Desktop Companion in dev mode...
cd desktop-client
set PORTAL_URL=http://localhost:3000
call npm install
call npm start
cd ..
