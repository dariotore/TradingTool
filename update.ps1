# =============================================================================
# update.ps1 — Aggiorna TradingTool da GitHub e riavvia i servizi
# Uso: PowerShell -ExecutionPolicy Bypass -File update.ps1
# =============================================================================

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  TradingTool — Aggiornamento" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# ── Pull da GitHub ────────────────────────────────────────────────────────────
Write-Host "[1/4] Git pull..." -ForegroundColor Green
$env:PATH += ";C:\Program Files\Git\bin"
Set-Location $root
git pull origin master
if (-not $?) { Write-Host "Errore git pull" -ForegroundColor Red; exit 1 }

# ── Aggiorna dipendenze Python ────────────────────────────────────────────────
Write-Host "[2/4] Aggiorna dipendenze Python..." -ForegroundColor Green
$pip = Join-Path $root "backend\venv\Scripts\pip.exe"
if (Test-Path $pip) {
    & $pip install -r (Join-Path $root "backend\requirements.txt") -q
    Write-Host "      Dipendenze aggiornate."
} else {
    Write-Host "      Venv non trovato, salto aggiornamento Python." -ForegroundColor Yellow
}

# ── Rebuild frontend ──────────────────────────────────────────────────────────
Write-Host "[3/4] Rebuild frontend..." -ForegroundColor Green
Set-Location (Join-Path $root "frontend")
npm install -q
npm run build
if (-not $?) { Write-Host "Errore build frontend" -ForegroundColor Red; Set-Location $root; exit 1 }
Set-Location $root

# ── Riavvia pm2 ───────────────────────────────────────────────────────────────
Write-Host "[4/4] Riavvia servizi..." -ForegroundColor Green
pm2 restart all
pm2 save

Write-Host ""
Write-Host "  Aggiornamento completato!" -ForegroundColor Green
Write-Host "  pm2 status per verificare lo stato." -ForegroundColor Yellow
Write-Host ""
