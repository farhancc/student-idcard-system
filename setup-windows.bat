@echo off
echo ===================================================
echo            IDexo Production Setup for Windows
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

echo [1/4] Installing root dependencies...
call npm install
if %errorlevel% neq 0 (
  echo Error: Root npm install failed.
  pause
  exit /b 1
)

echo [2/4] Generating Prisma Client...
call npx prisma generate
if %errorlevel% neq 0 (
  echo Error: Prisma Client generation failed.
  pause
  exit /b 1
)

echo [3/4] Running database migrations...
call npx prisma db push
if %errorlevel% neq 0 (
  echo Warning: Database migration (prisma db push) failed. 
  echo Ensure your .env file has a valid DATABASE_URL configured.
)

echo [4/4] Installing desktop-client dependencies...
cd desktop-client
call npm install
if %errorlevel% neq 0 (
  echo Error: Desktop client npm install failed.
  cd ..
  pause
  exit /b 1
)
cd ..

echo.
echo ===================================================
echo   IDexo Setup successfully completed on Windows!
echo.
echo   To build the desktop companion installer (.exe):
echo     Run build-desktop-installer.bat
echo.
echo   To launch the developer portal:
echo     Run dev-server.bat
echo ===================================================
echo.
pause
