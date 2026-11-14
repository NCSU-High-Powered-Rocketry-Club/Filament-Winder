@echo off
title WindStack - Filament Winder Controller
echo.
echo  ╔═══════════════════════════════════════════════╗
echo  ║        WindStack - Filament Winder v1.0.1     ║
echo  ║         Composite Winding Controller          ║
echo  ╚═══════════════════════════════════════════════╝
echo.

:: Find an available port (default 8080, fallback 8081-8089)
set PORT=8080

:: Check if Python is available
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python from https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

:: Start the server
echo  Starting WindStack server on http://localhost:%PORT% ...
echo.

:: Open the browser after a short delay
start "" "http://localhost:%PORT%"

:: Start the HTTP server (this blocks until Ctrl+C)
cd /d "%~dp0"
python -m http.server %PORT%

echo.
echo  Server stopped. Press any key to exit.
pause >nul
