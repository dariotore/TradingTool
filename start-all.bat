@echo off
REM Script per avviare Backend e Frontend contemporaneamente
REM Questo script apre due finestre separate: una per il backend e una per il frontend

echo.
echo ========================================================
echo      AVVIO COMPLETO - Trading Platform
echo      Backend + Frontend in due finestre separate
echo ========================================================
echo.

setlocal enabledelayedexpansion

REM Ottieni il percorso della cartella corrente
set SCRIPT_DIR=%~dp0

echo [1/2] Avvio Backend in una nuova finestra...
start "Trading Platform - Backend" "%SCRIPT_DIR%start-backend.bat"
timeout /t 2 /nobreak >nul

echo [2/2] Avvio Frontend in una nuova finestra...
start "Trading Platform - Frontend" "%SCRIPT_DIR%start-frontend.bat"

echo.
echo ========================================================
echo               [OK] SERVIZI IN AVVIO
echo ========================================================
echo.
echo Controlla le due nuove finestre nel taskbar:
echo   - "Trading Platform - Backend"
echo   - "Trading Platform - Frontend"
echo.
echo URL da aprire nel browser:
echo   http://localhost:3000
echo.
echo API Docs (se disponibili):
echo   http://localhost:8000/docs
echo.
echo Premi una freccia per chiudere questa finestra
echo ========================================================
echo.

pause
