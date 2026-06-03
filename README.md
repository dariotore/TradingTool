# 📈 Multi-Agent Crypto Trading Platform

Una piattaforma di analisi trading multi-agente per criptovalute, valute Forex e materie prime. Ogni agente specializzato analizza indipendentemente l'asset fornendo metriche diverse (fondamentali, tecniche, notizie, rischi) per una visione completa del mercato.

## 🎯 Caratteristiche

- **5 Agenti Specializzati** per criptovalute (BTC, ETH, SOL)
- **3 Agenti Specializzati** per Forex (EUR, GBP, JPY)
- **3 Agenti Specializzati** per Materie Prime (Oro, Argento, Petrolio)
- **Analisi in Real-Time** tramite WebSocket Binance (gratuito, senza autenticazione)
- **Sintesi Intelligente** con Claude AI (opzionale - fallback a logica rule-based)
- **Dashboard Interattiva** con grafici Recharts
- **API REST** documentata con Swagger

---

## 📋 Requisiti di Sistema

### Prima di Iniziare
- **Python 3.14+** (scarica da [python.org](https://www.python.org/downloads/))
- **Node.js 18+** (scarica da [nodejs.org](https://nodejs.org/))
- **npm** o **yarn** (incluso con Node.js)
- **Git** (opzionale, per clonare il repository)
- Un editor di codice (VS Code consigliato)

### API Keys (Opzionali)
- **CoinGecko API**: Gratuito, non richiede chiave (usato per metriche fondamentali)
- **CoinTelegraph/CoinDesk/Decrypt RSS**: Gratuito, accesso pubblico (notizie)
- **Binance WebSocket**: Gratuito, non richiede autenticazione (dati real-time)
- **Anthropic API Key**: Opzionale, per la sintesi con Claude AI (env var: `ANTHROPIC_API_KEY`)

---

## 🚀 Installazione Passo-Passo

### Step 1: Preparare la Cartella Principale

```bash
# Naviga alla cartella del progetto
cd C:\Claude_Projects\trading-platform

# Verifica che le cartelle backend e frontend esistono
ls
# Dovrebbe mostrare: backend/, frontend/, README.md
```

### Step 2: Installare il Backend

```bash
# Entra nella cartella backend
cd backend

# (Opzionale) Crea un virtual environment
python -m venv venv

# Attiva il virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Installa le dipendenze
pip install fastapi uvicorn requests aiohttp

# (Opzionale) Se vuoi usare Claude AI per la sintesi:
# pip install anthropic
```

### Step 3: Configurare le Variabili d'Ambiente (Backend)

```bash
# Crea un file .env nella cartella backend
# Windows: notepad .env
# macOS/Linux: nano .env

# Aggiungi queste linee (la API key di Anthropic è OPZIONALE):
ANTHROPIC_API_KEY=sk-your-key-here  # Solo se hai una chiave, altrimenti lascia vuota

# Salva il file (Ctrl+S in notepad, Ctrl+X then Y in nano)
```

### Step 4: Installare il Frontend

```bash
# Torna alla cartella principale
cd ..

# Entra nella cartella frontend
cd frontend

# Installa le dipendenze Node.js
npm install

# Verifica che package.json esiste (dovrebbe contenere Next.js, Tailwind, Recharts)
```

### Step 5: Avviare il Backend e Frontend

#### Opzione A: Usare gli Script Automatici (Consigliato) 🎯

**Script Backend:**
```bash
# Double-click su: start-backend.bat
# Oppure da terminale:
start-backend.bat
```

**Script Frontend (in una nuova finestra):**
```bash
# Double-click su: start-frontend.bat
# Oppure da terminale:
start-frontend.bat
```

**Script Completo (Backend + Frontend insieme):**
```bash
# Double-click su: start-all.bat
# Oppure da terminale:
start-all.bat
```

✅ Gli script gestiranno automaticamente:
- ✓ Installazione dipendenze
- ✓ Creazione file .env (se necessario)
- ✓ Avvio server su porte corrette
- ✓ Log e messaggi di status

---

#### Opzione B: Avvio Manuale

**Backend:**
```bash
cd backend
python -m uvicorn main:app --port 8000 --reload

# Dovrebbe mostrare:
# INFO:     Uvicorn running on http://127.0.0.1:8000
# INFO:     Application startup complete
```

**Frontend (in un nuovo terminale):**
```bash
cd frontend
npm run dev

# Dovrebbe mostrare:
# ▲ Next.js 15.0.0
# - Local:        http://localhost:3000
```

✅ **Servizi pronti!**
- Backend: http://localhost:8000/docs
- Frontend: http://localhost:3000

---

## 🏗️ Architettura del Sistema

```
trading-platform/
├── backend/
│   ├── main.py                 # Server FastAPI principale
│   ├── agents/
│   │   ├── fundamental.py      # Analisi fondamentali (CoinGecko)
│   │   ├── technical.py        # Analisi tecniche (RSI, MACD, Bollinger)
│   │   ├── news.py             # Sentiment dalle notizie (RSS feeds)
│   │   ├── risk.py             # Analisi rischi (volatilità, drawdown)
│   │   ├── synthesis.py        # Sintesi con Claude AI (opzionale)
│   │   ├── forex_fundamental.py
│   │   ├── forex_technical.py
│   │   ├── forex_news.py
│   │   ├── commodity_fundamental.py
│   │   ├── commodity_technical.py
│   │   └── commodity_news.py
│   ├── data/
│   │   ├── coins.py            # Asset crypto supportati
│   │   ├── forex.py            # Coppie Forex supportate
│   │   └── commodities.py      # Materie prime supportate
│   ├── utils/
│   │   └── telegram.py         # Utilità per notifiche
│   └── .env                    # Variabili d'ambiente (create tu)
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx            # Home page
│   │   ├── layout.tsx          # Layout globale
│   │   └── [asset]/
│   │       └── page.tsx        # Pagina dettagli asset
│   ├── components/
│   │   ├── AssetCard.tsx       # Card singolo asset
│   │   ├── Chart.tsx           # Grafici Recharts
│   │   └── Dashboard.tsx       # Dashboard principale
│   ├── public/                 # Asset statici (immagini, etc)
│   ├── package.json
│   └── tsconfig.json
│
└── README.md                   # Questo file!
```

---

## 🤖 Gli Agenti Specializzati

### 1. **Agente Fondamentale** (`agents/fundamental.py`)

**Cosa fa:**
- Analizza i dati fondamentali dell'asset (prezzo, market cap, volume)
- Calcola variazioni di prezzo (1h, 24h, 7d, 30d)
- Usa API CoinGecko (gratuita)

**Metriche fornite:**
- `price`: Prezzo attuale in USDT
- `price_change_24h`: Variazione % nelle ultime 24 ore
- `price_change_7d`: Variazione % negli ultimi 7 giorni
- `market_cap`: Capitalizzazione di mercato
- `volume_24h`: Volume scambiato in 24h

**Endpoint API:**
```
GET /api/agents/fundamental/{asset}
```

**Esempio risposta:**
```json
{
  "asset": "BTC",
  "price": 45000,
  "price_change_24h": 2.5,
  "price_change_7d": 5.3,
  "market_cap": 900000000000,
  "volume_24h": 25000000000
}
```

---

### 2. **Agente Tecnico** (`agents/technical.py`)

**Cosa fa:**
- Analizza indicatori tecnici (RSI, MACD, Bollinger Bands)
- Scarica klines (candlestick) da Binance
- Implementa calcoli manuali (non usa pandas-ta per compatibilità)

**Metriche fornite:**
- `rsi`: Relative Strength Index (30-70 normali, <30 oversold, >70 overbought)
- `macd`: Moving Average Convergence Divergence (trend seguente)
- `macd_signal`: Linea di segnale MACD
- `bollinger_upper`: Banda superiore Bollinger
- `bollinger_middle`: Media mobile 20gg
- `bollinger_lower`: Banda inferiore Bollinger
- `signal`: "BUY", "SELL", "NEUTRAL"

**Endpoint API:**
```
GET /api/agents/technical/{asset}
```

**Esempio risposta:**
```json
{
  "asset": "BTC",
  "rsi": 65.3,
  "macd": 1200,
  "macd_signal": 1150,
  "bollinger_upper": 46000,
  "bollinger_middle": 45000,
  "bollinger_lower": 44000,
  "signal": "NEUTRAL"
}
```

---

### 3. **Agente Notizie** (`agents/news.py`)

**Cosa fa:**
- Scarica RSS feed da 3 fonti crypto: CoinTelegraph, CoinDesk, Decrypt
- Analizza il sentiment delle notizie (positivo, neutrale, negativo)
- Ricerca keyword correlate all'asset

**Metriche fornite:**
- `sentiment_score`: Score -1 (molto negativo) a +1 (molto positivo)
- `recent_headlines`: Lista ultime 5 notizie
- `sentiment_distribution`: % positive/neutral/negative
- `news_count_24h`: Numero notizie nelle ultime 24h

**Endpoint API:**
```
GET /api/agents/news/{asset}
```

**Esempio risposta:**
```json
{
  "asset": "ETH",
  "sentiment_score": 0.35,
  "recent_headlines": [
    "ETH breaks above $2500 on institutional buying",
    "Ethereum staking reaches new high"
  ],
  "sentiment_distribution": {
    "positive": 60,
    "neutral": 30,
    "negative": 10
  },
  "news_count_24h": 15
}
```

---

### 4. **Agente Rischi** (`agents/risk.py`)

**Cosa fa:**
- Analizza rischi dell'asset (volatilità, drawdown, stop-loss suggerito)
- Calcola metriche di volatilità storica
- Stima livelli di stop-loss sicuri

**Metriche fornite:**
- `volatility`: Volatilità annualizzata (%)
- `max_drawdown`: Massimo drawdown degli ultimi 30 giorni (%)
- `suggested_stop_loss`: Livello suggerito di stop-loss (%)
- `risk_level`: "LOW", "MEDIUM", "HIGH"
- `sharpe_ratio`: Rapporto rendimento/rischio

**Endpoint API:**
```
GET /api/agents/risk/{asset}
```

**Esempio risposta:**
```json
{
  "asset": "SOL",
  "volatility": 45.2,
  "max_drawdown": -15.3,
  "suggested_stop_loss": 8.5,
  "risk_level": "MEDIUM",
  "sharpe_ratio": 0.85
}
```

---

### 5. **Agente Sintesi** (`agents/synthesis.py`)

**Cosa fa:**
- Combina tutte le analisi (fondamentali, tecniche, notizie, rischi)
- Genera un rapporto coerente e raccomandazioni
- Usa Claude AI se disponibile, altrimenti logica rule-based

**Metriche fornite:**
- `recommendation`: "STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"
- `confidence_score`: 0-100 (livello di confidenza della raccomandazione)
- `analysis_summary`: Testo descrittivo dell'analisi
- `key_factors`: Fattori chiave che influenzano la decisione
- `price_target`: Prezzo obiettivo a 30 giorni
- `time_frame`: "short_term", "medium_term", "long_term"

**Endpoint API:**
```
GET /api/agents/synthesis/{asset}
```

**Esempio risposta:**
```json
{
  "asset": "BTC",
  "recommendation": "BUY",
  "confidence_score": 78,
  "analysis_summary": "Bitcoin mostra segnali tecnici positivi con RSI in zona neutrale...",
  "key_factors": [
    "RSI in zona di accumulo (50-70)",
    "MACD positivo e sopra linea segnale",
    "Sentimento notizie moderatamente positivo",
    "Volatilità media, rischi controllati"
  ],
  "price_target": 48000,
  "time_frame": "medium_term"
}
```

---

## 🌍 Asset Supportati

### Criptovalute (Crypto)
- **BTC** (Bitcoin)
- **ETH** (Ethereum)
- **SOL** (Solana)

### Forex
- **EUR** (Euro)
- **GBP** (Sterlina Britannica)
- **JPY** (Yen Giapponese)

### Materie Prime
- **GOLD** (Oro)
- **SILVER** (Argento)
- **OIL** (Petrolio)

### Come Aggiungere Nuovi Asset

Modifica il file `backend/data/coins.py`, `forex.py` o `commodities.py` e aggiungi il nuovo asset alla lista.

---

## 📊 API Endpoints

### Endpoint Generici

```
GET /                           # Home (HTML info)
GET /api/assets                 # Lista tutti gli asset
GET /api/assets/{asset_type}   # Asset di un tipo specifico (crypto, forex, commodities)
```

### Endpoint per Singolo Asset

```
GET /api/{asset_type}/{asset}                      # Analisi completa dell'asset
GET /api/{asset_type}/{asset}/fundamental          # Solo fondamentali
GET /api/{asset_type}/{asset}/technical            # Solo tecnici
GET /api/{asset_type}/{asset}/news                 # Solo notizie
GET /api/{asset_type}/{asset}/risk                 # Solo rischi
GET /api/{asset_type}/{asset}/synthesis            # Solo sintesi
```

### Esempi di Utilizzo

```bash
# Analisi completa Bitcoin
curl http://localhost:8000/api/crypto/BTC

# Solo fondamentali Bitcoin
curl http://localhost:8000/api/crypto/BTC/fundamental

# Solo notizie Ethereum
curl http://localhost:8000/api/crypto/ETH/news

# Sentimento EUR/USD
curl http://localhost:8000/api/forex/EUR/news

# Rischi Oro
curl http://localhost:8000/api/commodities/GOLD/risk
```

### Documentazione Interattiva

Visita **http://localhost:8000/docs** per Swagger UI con possibilità di testare gli endpoint.

---

## 🎨 Frontend - Navigazione

### Home Page (`http://localhost:3000`)
- Mostra tutte le criptovalute supportate in grid
- Card per ogni asset con metriche principali
- Click su una card per analisi dettagliata

### Pagina Dettagli Asset (`http://localhost:3000/[asset]`)
- Analisi completa dell'asset
- Grafici interattivi Recharts
- Raccomandazione di sintesi in evidenza
- Dettagli di ogni agente separatamente

### Componenti Principali
- **AssetCard**: Card con metriche dell'asset
- **Chart**: Grafici Recharts per visualizzare trend
- **Dashboard**: Griglia principale degli asset

---

## 🔧 Troubleshooting

### Backend non si avvia

```bash
# Verifica che Python 3.14+ è installato
python --version

# Verifica che FastAPI è installato
pip list | findstr fastapi

# Reinstalla le dipendenze
pip install --upgrade -r requirements.txt
```

### Frontend non si avvia

```bash
# Verifica che Node.js è installato
node --version
npm --version

# Pulisci node_modules e reinstalla
rm -r node_modules package-lock.json
npm install

# Riprova
npm run dev
```

### Backend risponde lentamente

Le richieste ai dati real-time (Binance, CoinGecko) possono essere lente su connessioni lente. Considera:
- Testare con `curl http://localhost:8000/api/crypto/BTC` per isolare il problema
- Controllare la velocità della connessione internet
- Verificare se i servizi esterni (Binance, CoinGecko) sono raggiungibili

### Errore "Connection refused"

```bash
# Verifica che backend è in ascolto sulla porta 8000
netstat -ano | findstr 8000

# Se la porta è occupata, cambia porta:
py -m uvicorn main:app --port 8001 --reload

# Aggiorna il frontend per collegarsi a 8001
```

---

## 🚀 Prossimi Passi

### Per Sviluppatori
1. Leggi il codice degli agenti in `backend/agents/`
2. Prova a modificare la logica di sintesi in `synthesis.py`
3. Aggiungi nuovi indicatori tecnici in `technical.py`

### Per Utenti
1. Configura ANTHROPIC_API_KEY per abilitare Claude AI
2. Monitora le raccomandazioni sulla dashboard
3. Personalizza gli asset che segui in `data/coins.py`

### Feature Future
- [ ] Backtesting degli agenti
- [ ] Alerting su Telegram/Email
- [ ] Historico prezzi e trend
- [ ] Supporto per ulteriori crypto/Forex
- [ ] Configurazione UI per scegliere gli asset

---

## 📝 Licenza

Questo progetto è fornito così com'è per uso educativo e di ricerca.

## 💬 Supporto

Per domande su come funzionano gli agenti o come estendere il sistema, consulta il codice nel folder `backend/agents/`. Ogni agente è ben commentato e autonomo.

---

**Buon trading! 📈**
