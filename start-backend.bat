@echo off
REM Script per avviare il Backend FastAPI
REM Questo script installa le dipendenze Python e avvia il server su porta 8000

setlocal enabledelayedexpansion

echo.
echo ========================================================
echo          AVVIO BACKEND - Trading Platform
echo ========================================================
echo.

REM Naviga alla cartella backend
cd /d "%~dp0backend" || (
    echo Errore: Impossibile navigare alla cartella backend
    pause
    exit /b 1
)

echo [1/4] Verifica dipendenze Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo Errore: Python non trovato. Scaricalo da https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [2/4] Installazione dipendenze...
python -m pip install --quiet "uvicorn[standard]" fastapi httpx pandas beautifulsoup4 feedparser python-dotenv aiohttp aiohttp-cors requests 2>&1 | find "Successfully" >nul
if errorlevel 1 (
    echo - Installazione completata con avvisi (potrebbero essere normali)
) else (
    echo [OK] Dipendenze pronte
)

REM Crea .env file se non esiste
if not exist ".env" (
    echo [3/4] Creazione file .env...
    (
        echo # Variabili d'ambiente Trading Platform
        echo # Inserisci la tua API key di Anthropic (opzionale^)
        echo # ANTHROPIC_API_KEY=sk-your-key-here
    ) > .env
    echo [OK] File .env creato
) else (
    echo [3/4] File .env trovato
)

echo [4/4] Avvio server FastAPI...
echo.
echo ========================================================
echo                   SERVER IN AVVIO
echo ========================================================
echo URL: http://localhost:8000
echo Docs: http://localhost:8000/docs
echo ReDoc: http://localhost:8000/redoc
echo ========================================================
echo.
echo Premi Ctrl+C per fermare il server
echo.

python -m uvicorn main:app --port 8000 --reload --log-level info

if errorlevel 1 (
    echo.
    echo [ERRORE] Errore durante l'avvio del server
    echo Controlla i log sopra per i dettagli
    pause
    exit /b 1
)
