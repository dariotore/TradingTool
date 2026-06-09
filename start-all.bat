@echo off
cd /d C:\Projects\TradingTool

:: Crea cartella logs se non esiste
if not exist "C:\Projects\TradingTool\logs" mkdir "C:\Projects\TradingTool\logs"
set LOG=C:\Projects\TradingTool\logs\startup.log

echo [%DATE% %TIME%] Avvio TradingTool... >> %LOG%

:: Aggiungi npm global al PATH (Task Scheduler non lo include automaticamente)
set PATH=%PATH%;%APPDATA%\npm;C:\Program Files\nodejs

:: Verifica che pm2 sia trovato
where pm2 >> %LOG% 2>&1
if errorlevel 1 (
    echo [%DATE% %TIME%] ERRORE: pm2 non trovato nel PATH >> %LOG%
    exit /b 1
)

:: Avvia pm2
pm2 start C:\Projects\TradingTool\ecosystem.config.js >> %LOG% 2>&1
pm2 save >> %LOG% 2>&1

echo [%DATE% %TIME%] Avvio completato. >> %LOG%
