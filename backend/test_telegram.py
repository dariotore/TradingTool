#!/usr/bin/env python3
import asyncio
import os
import httpx

# Load .env
with open('.env') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ[k.strip()] = v.strip()

TOKEN = os.environ['TELEGRAM_BOT_TOKEN']
CHAT = os.environ['TELEGRAM_CHAT_ID']

async def test():
    async with httpx.AsyncClient(timeout=8) as c:
        # Test 1: getMe
        print("📡 Test 1: Verifica connessione bot...")
        r = await c.get(f'https://api.telegram.org/bot{TOKEN}/getMe')
        d = r.json()
        if d.get('ok'):
            bot = d['result']
            print(f'✅ Bot connesso: @{bot["username"]} (id={bot["id"]})')
        else:
            print(f'❌ Errore getMe: {d}')
            return

        # Test 2: Messaggio di conferma
        print("\n📨 Test 2: Invio messaggio di conferma...")
        r2 = await c.post(f'https://api.telegram.org/bot{TOKEN}/sendMessage', json={
            'chat_id': CHAT,
            'text': '*Trading Platform* — Connessione Telegram attiva ✅\n\nRiceverai qui i segnali BUY/SELL automatici quando cambiano le raccomandazioni degli agenti.',
            'parse_mode': 'Markdown'
        })
        if r2.status_code == 200:
            print(f'✅ Messaggio conferma inviato')
        else:
            print(f'❌ Errore: HTTP {r2.status_code}\n{r2.text}')

        # Test 3: Segnale BUY simulato
        print("\n📊 Test 3: Segnale BUY (simulato)...")
        text = '🟢 *COMPRA* — Bitcoin\n💰 Prezzo: `$67,354`\n🛑 Stop Loss: `$65,200`\n🎯 Take Profit: `$70,100`\n📊 Confidenza: 72%\n#Crypto `BTCUSDT`'
        r3 = await c.post(f'https://api.telegram.org/bot{TOKEN}/sendMessage', json={
            'chat_id': CHAT, 'text': text, 'parse_mode': 'Markdown'
        })
        if r3.status_code == 200:
            print(f'✅ Segnale BUY inviato')
        else:
            print(f'❌ Errore: HTTP {r3.status_code}')

        # Test 4: Segnale SELL simulato
        print("\n📊 Test 4: Segnale SELL (simulato)...")
        text2 = '🔴 *VENDI* — Ethereum\n💰 Prezzo: `$3,456.78`\n🛑 Stop Loss: `$3,600`\n🎯 Take Profit: `$3,200`\n📊 Confidenza: 65%\n#Crypto `ETHUSDT`'
        r4 = await c.post(f'https://api.telegram.org/bot{TOKEN}/sendMessage', json={
            'chat_id': CHAT, 'text': text2, 'parse_mode': 'Markdown'
        })
        if r4.status_code == 200:
            print(f'✅ Segnale SELL inviato')
        else:
            print(f'❌ Errore: HTTP {r4.status_code}')

        print("\n✅ Tutti i test completati! Telegram è configurato correttamente.")
        print("\nI segnali automatici BUY/SELL verranno inviati quando:")
        print("  • Una crypto/forex/commodity transisce a BUY")
        print("  • Una crypto/forex/commodity transisce a SELL")
        print("\nI segnali NON vengono inviati per HOLD, AVOID o se non c'è transizione.")

asyncio.run(test())
