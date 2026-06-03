# 🎯 Guida di Avvio - Trading Platform

## Test Completato ✅

**Risultato:** Backend ONLINE su porta 8000 e rispondente

---

## 🚀 Avvio Rapido

### Metodo 1: Script Automatico (Consigliato)

**Doppio-click su:** `start-all.bat`

Questo aprirà due finestre:
- Finestra 1: Backend FastAPI (porta 8000)
- Finestra 2: Frontend Next.js (porta 3000)

**Poi apri il browser su:** `http://localhost:3000`

---

### Metodo 2: Avvio Manuale

**Finestra 1 - Backend:**
```batch
cd backend
python -m uvicorn main:app --port 8000 --reload
```

**Finestra 2 - Frontend:**
```batch
cd frontend
npm run dev
```

---

## 🧪 Test dei Miglioramenti UX

Una volta che il browser è aperto su `http://localhost:3000`:

### Test 1: Auto-scroll al Top ✓
```
1. Scorri verso il basso nella lista di crypto a sinistra
2. Clicca su "SOL" (l'ultima crypto che richiede scroll)
3. VERIFICA: La pagina scrolls automaticamente al top 
   mostrando subito il grafico
```

### Test 2: Sticky Header ✓
```
1. Sei sulla pagina di SOL (da Test 1)
2. Scorri verso il basso nella pagina principale
3. VERIFICA: L'header con "Solana / SOLUSDT + prezzo"
   rimane sempre visibile in alto mentre scrolli
```

### Test 3: Mobile Drawer ✓
```
1. Ridimensiona il browser a larghezza mobile (< 768px)
   Oppure apri il browser mobile / dev tools mobile
2. Clicca il menu hamburger (≡) in alto a sinistra
3. VERIFICA: Il drawer scorre da sinistra con
   animazione fluida e sfondo in backdrop
```

---

## 📋 Dettagli dei Miglioramenti Implementati

### 1️⃣ Auto-scroll (handleSelect)
**File:** `frontend/app/page.tsx` linea ~224-232

```typescript
const handleSelect = useCallback((id: string) => {
  setActiveId(id);
  setSidebarOpen(false);
  // Auto-scroll a smooth al top della sezione main
  setTimeout(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, 50);
}, []);
```

**Come funziona:**
- Quando clicchi su un asset, la funzione scatta
- Scrolls smooth al top della sezione di analisi
- Impedisce ai dati di rimanere nascosti sotto

---

### 2️⃣ Sticky Header
**File:** `frontend/app/page.tsx` linea ~451-467

```typescript
<div className="sticky top-0 z-20 bg-[#070c18]/95 backdrop-blur-sm 
              border-b border-[#1a2e48] px-4 md:px-5 py-3 shrink-0">
  {/* Nome asset + Prezzo + Cambio 24h */}
</div>
```

**Come funziona:**
- `sticky top-0` mantiene l'elemento in posizione
- `z-20` lo tiene sopra il contenuto
- `backdrop-blur-sm` aggiunge blur dietro
- Rimane visibile mentre scrolli

---

### 3️⃣ Mobile Drawer Animato
**File:** `frontend/app/page.tsx` linea ~401-422

```typescript
<aside className="... animate-in slide-in-from-left duration-300">
  {/* Lista crypto */}
</aside>
```

**Come funziona:**
- `animate-in` attiva animazioni Tailwind
- `slide-in-from-left` scorre da sinistra
- `duration-300` è la durata dell'animazione (300ms)
- Crea transizione fluida e smooth

---

## 🔧 Troubleshooting

### Backend non si avvia
- Controlla che Python 3.14+ sia installato: `python --version`
- Assicurati che la porta 8000 sia libera
- Leggi gli errori nella finestra del backend

### Frontend non si carica
- Il primo avvio potrebbe impiegare 10-20 secondi
- Controlla che Node.js sia installato: `node --version`
- Assicurati che la porta 3000 sia libera

### Porta già in uso
- Chiudi le finestre precedenti di Backend/Frontend
- Oppure usa il Task Manager per terminare processi Python/Node

---

## 📊 Informazioni Tecniche

**Stack:**
- Backend: FastAPI + Python 3.14
- Frontend: Next.js 15 + Tailwind + Recharts
- Real-time: WebSocket per aggiornamenti live

**Porte:**
- Backend: 8000
- Frontend: 3000

**API:**
- Documentazione: http://localhost:8000/docs
- Health Check: http://localhost:8000/api/coins

---

## ✨ Prossimi Passi

1. ✅ Apri http://localhost:3000
2. ✅ Seleziona una criptovaluta
3. ✅ Testa gli UX improvements (auto-scroll, sticky header)
4. ⏳ (Opzionale) Configura ANTHROPIC_API_KEY in `backend/.env`

---

**Buon trading!** 📈
