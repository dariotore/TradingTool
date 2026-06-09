@echo off
cd /d %~dp0

REM Attiva il virtualenv se esiste, altrimenti usa Python di sistema
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
)

python -m uvicorn main:app --host 0.0.0.0 --port 8000
