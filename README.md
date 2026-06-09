# Trading Platform — Multi-Agent Analysis System

Una piattaforma professionale di analisi trading multi-agente per criptovalute, Forex e materie prime. Ogni asset viene analizzato in parallelo da quattro agenti specializzati (fondamentale, tecnico, notizie, rischio) il cui output confluisce in un agente di sintesi che emette una raccomandazione operativa.

---

## Caratteristiche principali

### Analisi tecnica professionale
- **ADX di Wilder** (14 periodi) per misurare la forza del trend
- **Stocastico** (%K/%D) con segnali di ipercomprato/ipervenduto
- **Market Structure** — rilevamento automatico di Higher High / Higher Low (uptrend/downtrend/ranging)
- **Divergenza RSI** — divergenza rialzista/ribassista su finestra 14 periodi
- **Volume Surge** — picco di volume anomalo rispetto alla media
- RSI, MACD, Bande di Bollinger, EMA 50/200

### Multi-timeframe (MTF)
Ogni analisi tecnica esegue in parallelo (`asyncio.gather`) due fetch Yahoo Finance: **orario** (30 giorni) e **daily** (90 giorni). Il trend giornaliero viene usato come filtro di conferma/veto sul segnale orario.

### Supporti e Resistenze dinamiche
- Swing high/low con clustering a ±0.3%
- Pivot points classici (PP, R1, R2, S1, S2)
- I livelli S/R calcolati sostituiscono lo stop-loss e take-profit basati sulla volatilità

### Pattern candlestick
Rilevamento automatico di 7 pattern: Doji, Hammer, Shooting Star, Bullish/Bearish Engulfing, Morning Star, Evening Star.

### Sintesi regime-aware
Pesi degli agenti adattivi in base all'ADX:

| Regime | Fondamentale | Tecnico | Notizie | Rischio |
|--------|-------------|---------|---------|---------|
| Trending (ADX > 25) | 20% | 45% | 15% | 20% |
| Ranging (ADX < 20)  | 30% | 30% | 20% | 20% |
| Default             | 25% | 35% | 20% | 20% |

La sintesi applica ulteriori filtri: veto MTF counter-trend, veto divergenza RSI, regime filter (no STRONG in ranging), confluenza multi-agente.

### Metriche di rischio avanzate
- Sortino ratio, VaR 95%, Calmar ratio
- Kelly Criterion (half-Kelly, capped 1–10%) per il position sizing
- Sharpe ratio, Max Drawdown, volatilità annualizzata

### Sistema di auto-apprendimento
Ogni segnale BUY/SELL viene salvato in un database SQLite locale (`signals.db`). Ogni ora un task in background verifica il prezzo a **4h** e **24h** e registra se la direzione era corretta. Questi dati alimentano un **moltiplicatore di confidenza adattivo** (0.70–1.20) che viene applicato ai segnali successivi dello stesso simbolo e regime.

### Storico segnali e dashboard accuratezza
Pagina `/history` con:
- Tre grafici a barre (Crypto / Forex / Commodity) che mostrano segnali corretti, errati e in attesa per simbolo
- Card di accuratezza globale, trending e ranging
- Tabella filtrable e ordinabile con tutti i segnali: azione, confidenza, prezzo, **Stop Loss**, **Take Profit**, regime, MTF, outcome 4h e 24h
- Pulsante "Pulizia DB" per eliminare i record senza SL/TP

### Notifiche Telegram
Invio automatico di alert su Telegram a ogni transizione verso BUY/SELL (non invia duplicati dello stesso segnale).

---

## Struttura del progetto

```
TradingTool-main/
├── backend/
│   ├── main.py                      # FastAPI app, loop analisi, WebSocket, endpoint REST
│   ├── agents/
│   │   ├── forex_technical.py       # Libreria indicatori condivisa (master)
│   │   ├── technical.py             # Agente tecnico Crypto (importa da forex_technical)
│   │   ├── commodity_technical.py   # Agente tecnico Commodity (importa da forex_technical)
│   │   ├── fundamental.py           # Agente fondamentale Crypto (CoinGecko)
│   │   ├── forex_fundamental.py
│   │   ├── commodity_fundamental.py
│   │   ├── news.py                  # Agente notizie Crypto (RSS)
│   │   ├── forex_news.py
│   │   ├── commodity_news.py
│   │   ├── risk.py                  # Agente rischio Crypto
│   │   ├── forex_risk.py
│   │   ├── commodity_risk.py
│   │   └── synthesis.py             # Sintesi regime-aware + auto-apprendimento
│   ├── data/
│   │   ├── coins.py                 # Top 30 crypto da CoinGecko
│   │   ├── forex.py                 # Coppie Forex
│   │   └── commodities.py           # Materie prime
│   ├── utils/
│   │   ├── yahoo_history.py         # Fetch OHLCV (orario + daily) con cache
│   │   ├── signal_db.py             # SQLite: salvataggio segnali, outcome, statistiche
│   │   ├── outcome_checker.py       # Valutazione automatica outcome 4h/24h
│   │   └── telegram.py              # Notifiche Telegram
│   ├── signals.db                   # Database SQLite (generato automaticamente)
│   └── .env                         # Variabili d'ambiente
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx                 # Dashboard principale (Crypto / Forex / Commodity)
│   │   └── history/
│   │       └── page.tsx             # Storico segnali e grafici accuratezza
│   └── components/
│       ├── SynthesisPanel.tsx       # Pannello raccomandazione con badge apprendimento
│       └── ...
│
└── README.md
```

> **Nota:** tutta la matematica degli indicatori è centralizzata in `forex_technical.py` e importata dagli altri due agenti tecnici. Un'unica implementazione evita derive tra mercati.

---

## Requisiti

| Componente | Versione minima |
|-----------|----------------|
| Python    | 3.11+           |
| Node.js   | 18+             |
| npm       | 9+              |

### Dipendenze Python

```bash
pip install fastapi uvicorn httpx pandas python-dotenv beautifulsoup4 anthropic
```

### Dipendenze Node.js

```bash
cd frontend && npm install
```

Pacchetti principali: Next.js 16, React 19, Recharts 3, Tailwind CSS 4, Lucide React.

---

## Configurazione

Crea il file `backend/.env`:

```env
# Obbligatorio per le notifiche Telegram (opzionale)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Obbligatorio per la sintesi con Claude AI (opzionale — fallback rule-based)
ANTHROPIC_API_KEY=

# URL backend usato dal frontend (default: http://localhost:8000)
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

Tutte le variabili sono opzionali: la piattaforma funziona completamente offline e senza chiavi API.

---

## Avvio

**Backend:**
```bash
cd backend
python -m uvicorn main:app --port 8000 --reload
```

**Frontend (nuovo terminale):**
```bash
cd frontend
npm run dev
```

- Dashboard: http://localhost:3000
- Storico segnali: http://localhost:3000/history
- API docs (Swagger): http://localhost:8000/docs

---

## Endpoint REST principali

```
GET  /api/data                        # Snapshot crypto
GET  /api/forex/data                  # Snapshot forex
GET  /api/commodity/data              # Snapshot commodity
POST /api/refresh                     # Forza aggiornamento crypto
POST /api/forex/refresh               # Forza aggiornamento forex
POST /api/commodity/refresh           # Forza aggiornamento commodity

GET  /api/signals?limit=&market=&action=   # Storico segnali con outcome
GET  /api/signals/chart/{market}           # Dati grafici accuratezza per mercato
POST /api/signals/cleanup                  # Elimina segnali senza SL/TP
GET  /api/accuracy                         # Statistiche accuratezza globali
GET  /api/accuracy/{symbol}                # Statistiche per simbolo
POST /api/check-outcomes                   # Forza valutazione outcome

GET  /api/crypto/ohlcv?symbol=&interval=&limit=
GET  /api/forex/ohlcv?symbol=&interval=&limit=
GET  /api/commodity/ohlcv?symbol=&interval=&limit=

WS   /ws                              # WebSocket aggiornamenti real-time
```

---

## Flusso di analisi

```
Ogni 60 secondi per ogni asset:

  ┌─────────────────────────────────────────────┐
  │  asyncio.gather(fundamental, technical,      │
  │                 news, risk)                  │
  │                                              │
  │  technical:                                  │
  │   └─ asyncio.gather(ohlcv_1h, ohlcv_daily)  │
  │       ├─ ADX, Stochastic, Market Structure   │
  │       ├─ RSI Divergence, Volume Surge        │
  │       ├─ Candlestick Patterns (7)            │
  │       ├─ Support/Resistance + Pivot Points   │
  │       └─ MTF filter (daily trend)            │
  │                                              │
  │  risk:                                       │
  │   └─ Sortino, VaR 95%, Calmar, Kelly        │
  └─────────────────────┬───────────────────────┘
                        │
                   synthesis.run()
                        │
          ┌─────────────┴──────────────┐
          │  1. Seleziona pesi regime   │
          │  2. Score pesato            │
          │  3. Confluence boost/veto   │
          │  4. MTF counter-trend veto  │
          │  5. Divergenza RSI veto     │
          │  6. Regime filter           │
          │  7. Moltiplicatore learning │
          │  8. SL/TP da S/R levels     │
          └─────────────┬──────────────┘
                        │
              ┌─────────┴─────────┐
              │  signal_db.save   │  ← solo BUY/SELL, dedup 30 min
              │  Telegram alert   │  ← solo su transizioni
              │  WS broadcast     │
              └───────────────────┘

Ogni ora:
  outcome_checker → verifica prezzo a 4h e 24h → aggiorna accuracy → adatta multiplier
```

---

## Sistema di auto-apprendimento

Il database `signals.db` contiene due tabelle:

- **`signals`** — ogni segnale BUY/SELL con timestamp, simbolo, mercato, confidenza, score, prezzo, stop-loss, take-profit, regime, MTF trend, divergenza, pattern candlestick
- **`outcomes`** — outcome a 4h e 24h: prezzo al check, variazione %, `direction_correct`

Il moltiplicatore di confidenza viene calcolato sull'accuratezza degli ultimi segnali valutati per quel simbolo e regime:

| Accuracy (24h) | Moltiplicatore |
|---------------|----------------|
| < 40%         | 0.70 (−30%)    |
| 40–50%        | 0.85 (−15%)    |
| 50–60%        | 1.00 (neutro)  |
| 60–70%        | 1.10 (+10%)    |
| ≥ 70%         | 1.20 (+20%)    |

Richiede almeno 10 segnali valutati prima di attivarsi.

---

## Troubleshooting

**Backend non si avvia — `ModuleNotFoundError`**
```bash
pip install fastapi uvicorn httpx pandas python-dotenv beautifulsoup4
```

**Yahoo Finance restituisce errori 429**
La cache OHLCV ha TTL di 5 minuti (orario) e 10 minuti (daily). Ridurre ulteriormente il ciclo di analisi può causare rate limiting.

**Frontend: `NEXT_PUBLIC_BACKEND_URL` non trovato**
Crea `frontend/.env.local` con:
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

**Porta 8000 occupata**
```bash
python -m uvicorn main:app --port 8001 --reload
# poi aggiorna NEXT_PUBLIC_BACKEND_URL=http://localhost:8001
```

---

## Disclaimer

Questo strumento è fornito a scopo educativo e di ricerca. Non costituisce consulenza finanziaria. Fare trading comporta rischi significativi di perdita del capitale.
