# 🚀 Quick Start - Trading Platform

## Avvio Veloce (2 secondi)

### Opzione 1: Avvio Completo (CONSIGLIATO)

**Doppio click su `start-all.bat`**

Questo apre due finestre separate:
- ✅ Backend su http://localhost:8000
- ✅ Frontend su http://localhost:3000

Poi apri il browser su **http://localhost:3000**

---

### Opzione 2: Avvio Separato

**Finestra 1 - Backend:**
```
Doppio click su: start-backend.bat
```

**Finestra 2 - Frontend:**
```
Doppio click su: start-frontend.bat
```

---

## Primo Avvio?

Se è la tua prima volta:

1. **Installa Node.js**: https://nodejs.org/ (se non hai npm)
2. **Installa Python 3.14+**: https://www.python.org/downloads/ (se non hai Python)
3. **Doppio click su `start-all.bat`**
4. **Apri http://localhost:3000** nel browser

I script installeranno automaticamente tutte le dipendenze! ⚙️

---

## Logs e Diagnostica

### Backend non si avvia?
- Controlla la finestra del backend per messaggi di errore
- Verifica che Python 3.14+ sia installato: `python --version`
- Controlla che la porta 8000 sia libera

### Frontend non si carica?
- Controlla la finestra del frontend per messaggi di errore
- Il primo avvio potrebbe impiegare 10-20 secondi
- Verifica che Node.js sia installato: `node --version`

### Errore: "Port 8000/3000 already in use"?
- Chiudi le finestre precedenti di Backend/Frontend
- Oppure uccidi i processi Python/Node dal task manager

---

## Comandi Utili

```bash
# Visualizza la documentazione API
http://localhost:8000/docs

# Verifica che il backend risponde
curl http://localhost:8000/api/coins

# Accedi al frontend
http://localhost:3000
```

---

## Prossimi Passi

1. ✅ Apri http://localhost:3000
2. ✅ Seleziona una criptovaluta dalla lista
3. ✅ Visualizza grafici e analisi real-time
4. ✅ (Opzionale) Configura `ANTHROPIC_API_KEY` in `backend/.env` per la sintesi con Claude

---

**Domande?** Controlla il file `README.md` per documentazione completa.

Buon trading! 📈
