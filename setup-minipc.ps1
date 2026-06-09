# =============================================================================
# setup-minipc.ps1
# Setup completo per Nipogi AK1 Plus (o qualsiasi Windows mini PC).
# Esegui UNA SOLA VOLTA con: PowerShell -ExecutionPolicy Bypass -File setup-minipc.ps1
# =============================================================================

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  TradingTool — Setup Mini PC" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# ── 0. IP locale del mini PC ──────────────────────────────────────────────────
$localIP = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*" } |
    Select-Object -First 1).IPAddress

Write-Host "IP locale rilevato: $localIP" -ForegroundColor Yellow
Write-Host "Il frontend sara' raggiungibile da LAN su: http://${localIP}:3000"
Write-Host ""

# ── 1. Verifica Node.js ───────────────────────────────────────────────────────
Write-Host "[1/7] Verifica Node.js..." -ForegroundColor Green
try {
    $nodeVer = node --version 2>$null
    Write-Host "      Node.js trovato: $nodeVer"
} catch {
    Write-Host "      Node.js non trovato. Installa da https://nodejs.org (LTS)" -ForegroundColor Red
    Write-Host "      Poi riesegui questo script." -ForegroundColor Red
    exit 1
}

# ── 2. Verifica Python ────────────────────────────────────────────────────────
Write-Host "[2/7] Verifica Python..." -ForegroundColor Green
$pythonCmd = $null
foreach ($cmd in @("python", "python3", "py")) {
    try {
        $ver = & $cmd --version 2>$null
        if ($ver -match "Python 3") {
            $pythonCmd = $cmd
            Write-Host "      Python trovato ($cmd): $ver"
            break
        }
    } catch { }
}
if (-not $pythonCmd) {
    Write-Host "      Python 3 non trovato. Installa da https://python.org" -ForegroundColor Red
    exit 1
}

# ── 3. Installa pm2 e pm2-windows-service ────────────────────────────────────
Write-Host "[3/7] Installa pm2 e pm2-windows-service..." -ForegroundColor Green
npm install -g pm2 pm2-windows-service
if (-not $?) { Write-Host "Errore installazione pm2" -ForegroundColor Red; exit 1 }

# Ricarica il PATH nella sessione corrente dopo npm install -g
$machinePath = [System.Environment]::GetEnvironmentVariable("Path","Machine")
$userPath    = [System.Environment]::GetEnvironmentVariable("Path","User")
$env:PATH    = "$machinePath;$userPath"

# Trova pm2.cmd nella cartella npm globale se ancora non è nel PATH
$npmGlobal = (npm root -g 2>$null) -replace "node_modules$", ""
if ($npmGlobal -and (Test-Path (Join-Path $npmGlobal "pm2.cmd"))) {
    $env:PATH += ";$npmGlobal"
}
Write-Host "      pm2 pronto: $(pm2 --version 2>$null)"

# ── 4. Setup Python virtualenv e dipendenze ───────────────────────────────────
Write-Host "[4/7] Setup Python virtualenv..." -ForegroundColor Green
$venvPath = Join-Path $root "backend\venv"
if (-not (Test-Path $venvPath)) {
    & $pythonCmd -m venv $venvPath
    Write-Host "      Venv creato in $venvPath"
} else {
    Write-Host "      Venv esistente trovato."
}

$pip = Join-Path $venvPath "Scripts\pip.exe"
& $pip install --upgrade pip -q
& $pip install -r (Join-Path $root "backend\requirements.txt")
if (-not $?) { Write-Host "Errore installazione dipendenze Python" -ForegroundColor Red; exit 1 }
Write-Host "      Dipendenze Python installate."

# ── 5. Build Next.js frontend ─────────────────────────────────────────────────
Write-Host "[5/7] Build frontend Next.js..." -ForegroundColor Green

# Crea .env.local con l'IP del mini PC (usato dal browser per raggiungere il backend)
$envLocal = Join-Path $root "frontend\.env.local"
$envContent = "NEXT_PUBLIC_BACKEND_URL=http://${localIP}:8000"
Set-Content -Path $envLocal -Value $envContent -Encoding utf8
Write-Host "      Creato $envLocal con: $envContent"

Set-Location (Join-Path $root "frontend")
npm install
if (-not $?) { Write-Host "Errore npm install" -ForegroundColor Red; Set-Location $root; exit 1 }
npm run build
if (-not $?) { Write-Host "Errore npm run build" -ForegroundColor Red; Set-Location $root; exit 1 }
Set-Location $root
Write-Host "      Frontend compilato."

# ── 6. Crea cartella logs ─────────────────────────────────────────────────────
Write-Host "[6/7] Crea cartella logs..." -ForegroundColor Green
$logsDir = Join-Path $root "logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir | Out-Null
}
Write-Host "      $logsDir creata."

# ── 7. Avvia pm2 e installa come servizio Windows ─────────────────────────────
Write-Host "[7/7] Configura pm2 come servizio Windows..." -ForegroundColor Green
pm2 start (Join-Path $root "ecosystem.config.js")
pm2 save
pm2-service-install -n "TradingPlatform" --unattended
if (-not $?) {
    Write-Host "      Servizio non installato (potrebbe richiedere privilegi admin)." -ForegroundColor Yellow
    Write-Host "      Riprova aprendo PowerShell come Amministratore." -ForegroundColor Yellow
} else {
    Write-Host "      Servizio 'TradingPlatform' installato. Parte automaticamente al boot." -ForegroundColor Green
}

# ── Regole firewall ───────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Apertura porte firewall (8000 backend, 3000 frontend)..." -ForegroundColor Green
try {
    New-NetFirewallRule -DisplayName "TradingTool Backend" -Direction Inbound `
        -Protocol TCP -LocalPort 8000 -Action Allow -ErrorAction SilentlyContinue | Out-Null
    New-NetFirewallRule -DisplayName "TradingTool Frontend" -Direction Inbound `
        -Protocol TCP -LocalPort 3000 -Action Allow -ErrorAction SilentlyContinue | Out-Null
    Write-Host "      Porte 3000 e 8000 aperte nel firewall."
} catch {
    Write-Host "      Impossibile aprire le porte automaticamente. Fallo manualmente." -ForegroundColor Yellow
}

# ── Riepilogo finale ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Setup completato!" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Frontend:  http://${localIP}:3000" -ForegroundColor White
Write-Host "  Backend:   http://${localIP}:8000" -ForegroundColor White
Write-Host "  Locale:    http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "  Comandi utili:" -ForegroundColor Yellow
Write-Host "    pm2 status          -> stato dei processi"
Write-Host "    pm2 logs            -> log in tempo reale"
Write-Host "    pm2 restart all     -> riavvia tutto"
Write-Host "    .\update.ps1        -> aggiorna da GitHub"
Write-Host ""
Write-Host "  Per accesso esterno (fuori casa):" -ForegroundColor Yellow
Write-Host "    1. Registra un host gratuito su https://www.duckdns.org"
Write-Host "    2. Configura port forwarding sul router: 3000 e 8000 -> $localIP"
Write-Host "    3. Aggiorna NEXT_PUBLIC_BACKEND_URL in frontend\.env.local"
Write-Host "    4. Riesegui: cd frontend; npm run build; pm2 restart trading-frontend"
Write-Host ""
