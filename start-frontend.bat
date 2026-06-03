@echo off
REM Script per avviare il Frontend Next.js
REM Questo script installa le dipendenze Node e avvia il dev server su porta 3000

setlocal enabledelayedexpansion

echo.
echo ========================================================
echo         AVVIO FRONTEND - Trading Platform
echo ========================================================
echo.

REM Naviga alla cartella frontend
cd /d "%~dp0frontend" || (
    echo Errore: Impossibile navigare alla cartella frontend
    pause
    exit /b 1
)

echo [1/3] Verifica Node.js e npm...
node --version >nul 2>&1
if errorlevel 1 (
    echo Errore: Node.js non trovato. Scaricalo da https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%a in ('node --version') do set NODE_VERSION=%%a
echo [OK] Node.js !NODE_VERSION! trovato

echo [2/3] Installazione dipendenze Node...
if not exist "node_modules" (
    echo - Prima installazione - attendere qualche minuto...
    call npm install
    if errorlevel 1 (
        echo [ERRORE] Errore nell'installazione di node_modules
        pause
        exit /b 1
    )
    echo [OK] node_modules installato
) else (
    echo [OK] node_modules gia presente
    REM Opzionale: aggiorna dipendenze
    REM call npm install
)

echo [3/3] Avvio dev server...
echo.
echo ========================================================
echo                   DEV SERVER IN AVVIO
echo ========================================================
echo URL: http://localhost:3000
echo Backend atteso su: http://localhost:8000
echo.
echo Nota: Il primo avvio potrebbe richiedere 10-20 sec
echo ========================================================
echo.
echo Premi Ctrl+C per fermare il server
echo.

set BROWSER=none
call npm run dev

if errorlevel 1 (
    echo.
    echo [ERRORE] Errore durante l'avvio del dev server
    echo Controlla i log sopra per i dettagli
    pause
    exit /b 1
)
