@echo off
echo ===================================================
echo   IDexo Desktop Companion Windows Installer Builder
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

echo [1/3] Navigating to desktop-client directory...
cd desktop-client

echo [2/3] Installing dependencies for electron app...
call npm install
if %errorlevel% neq 0 (
  echo Error: npm install failed.
  pause
  exit /b 1
)

echo [3/3] Packaging desktop companion for Windows (NSIS target)...
call npm run dist
if %errorlevel% neq 0 (
  echo Error: Packaging with electron-builder failed.
  cd ..
  pause
  exit /b 1
)
cd ..

echo.
echo ===================================================
echo   Windows Installer (.exe) successfully created in:
echo   desktop-client/dist/
echo ===================================================
echo.
pause
