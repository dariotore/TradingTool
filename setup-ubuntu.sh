#!/bin/bash
# =============================================================================
# setup-ubuntu.sh
# Setup completo per Ubuntu Server 24.04 LTS.
# Esegui UNA SOLA VOLTA con: bash setup-ubuntu.sh
# =============================================================================

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}  TradingTool — Setup Ubuntu Server${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""

# ── 0. IP locale ──────────────────────────────────────────────────────────────
LOCAL_IP=$(hostname -I | awk '{print $1}')
echo -e "${YELLOW}IP locale rilevato: $LOCAL_IP${NC}"
echo "Il frontend sarà raggiungibile da LAN su: http://${LOCAL_IP}:3000"
echo ""

# ── 1. Node.js 20 LTS ─────────────────────────────────────────────────────────
echo -e "${GREEN}[1/7] Verifica Node.js...${NC}"
if ! command -v node &>/dev/null; then
    echo "      Installazione Node.js 20 via NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo "      Node.js: $(node --version) | npm: $(npm --version)"

# ── 2. Python 3 + venv ────────────────────────────────────────────────────────
echo -e "${GREEN}[2/7] Verifica Python...${NC}"
if ! command -v python3 &>/dev/null; then
    sudo apt-get install -y python3 python3-pip python3-venv
fi
echo "      $(python3 --version)"

# ── 3. pm2 ────────────────────────────────────────────────────────────────────
echo -e "${GREEN}[3/7] Installa pm2...${NC}"
sudo npm install -g pm2
echo "      pm2: $(pm2 --version)"

# ── 4. Python virtualenv e dipendenze ─────────────────────────────────────────
echo -e "${GREEN}[4/7] Setup Python virtualenv...${NC}"
VENV="$ROOT/backend/venv"
if [ ! -d "$VENV" ]; then
    python3 -m venv "$VENV"
    echo "      Venv creato in $VENV"
else
    echo "      Venv esistente trovato."
fi
"$VENV/bin/pip" install --upgrade pip -q
"$VENV/bin/pip" install -r "$ROOT/backend/requirements.txt"
echo "      Dipendenze Python installate."

# ── 5. Build frontend Next.js ─────────────────────────────────────────────────
echo -e "${GREEN}[5/7] Build frontend Next.js...${NC}"
cat > "$ROOT/frontend/.env.local" <<EOF
NEXT_PUBLIC_BACKEND_URL=http://${LOCAL_IP}:8000
EOF
echo "      Creato .env.local → NEXT_PUBLIC_BACKEND_URL=http://${LOCAL_IP}:8000"
cd "$ROOT/frontend"
npm install
npm run build
cd "$ROOT"
echo "      Frontend compilato."

# ── 6. Cartella logs ──────────────────────────────────────────────────────────
echo -e "${GREEN}[6/7] Crea cartella logs...${NC}"
mkdir -p "$ROOT/logs"
echo "      $ROOT/logs creata."

# ── 7. pm2 startup ────────────────────────────────────────────────────────────
echo -e "${GREEN}[7/7] Configura pm2 come servizio...${NC}"
pm2 start "$ROOT/ecosystem.config.js"
pm2 save
# Genera e applica il comando di avvio automatico
STARTUP=$(pm2 startup systemd -u "$USER" --hp "$HOME" | grep "sudo env")
if [ -n "$STARTUP" ]; then
    eval "$STARTUP"
    echo "      Avvio automatico configurato."
else
    echo -e "${YELLOW}      Esegui manualmente: pm2 startup${NC}"
fi

# ── Firewall ufw ──────────────────────────────────────────────────────────────
echo ""
echo "Apertura porte firewall (8000 backend, 3000 frontend)..."
if command -v ufw &>/dev/null; then
    sudo ufw allow 8000/tcp comment "TradingTool backend" 2>/dev/null || true
    sudo ufw allow 3000/tcp comment "TradingTool frontend" 2>/dev/null || true
    sudo ufw allow OpenSSH 2>/dev/null || true
    echo "      Porte 3000 e 8000 aperte."
fi

# ── Riepilogo ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}  Setup completato!${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""
echo -e "  Frontend:  http://${LOCAL_IP}:3000"
echo -e "  Backend:   http://${LOCAL_IP}:8000"
echo -e "  Locale:    http://localhost:3000"
echo ""
echo -e "${YELLOW}  Comandi utili:${NC}"
echo "    pm2 status          -> stato dei processi"
echo "    pm2 logs            -> log in tempo reale"
echo "    pm2 restart all     -> riavvia tutto"
echo "    ./update.sh         -> aggiorna da GitHub"
echo ""
echo -e "${YELLOW}  Per accesso esterno (fuori casa):${NC}"
echo "    1. Registra un host su https://www.duckdns.org"
echo "    2. Configura port forwarding sul router: 3000 e 8000 -> $LOCAL_IP"
echo "    3. Aggiorna NEXT_PUBLIC_BACKEND_URL in frontend/.env.local"
echo "    4. Riesegui: cd frontend && npm run build && pm2 restart trading-frontend"
echo ""
