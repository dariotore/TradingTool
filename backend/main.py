import asyncio
import json
import os
from contextlib import asynccontextmanager
from urllib.parse import urlparse
from dotenv import load_dotenv

import httpx
import pandas as pd
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from data import coins as coin_registry
from data import forex as forex_registry
from agents import fundamental, technical, news, risk, synthesis
from agents import forex_technical, forex_fundamental, forex_risk, forex_news, forex_cot
from utils import telegram, signal_db, outcome_checker

load_dotenv()

AUTO_REFRESH_INTERVAL = 60  # 1 minute

active_connections: list[WebSocket] = []
latest_data:  dict = {}
latest_forex: dict = {}
_refresh_lock = asyncio.Lock()
_forex_lock   = asyncio.Lock()

# Track previous recommendations to send signals only on transitions
_prev_recs: dict[str, str] = {}

YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart"
YAHOO_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}


async def _outcome_loop():
    """Hourly background task: evaluate signal outcomes and feed the learning system."""
    await asyncio.sleep(60)   # short delay on startup, then run immediately
    while True:
        try:
            await outcome_checker.check_pending_outcomes()
        except Exception:
            pass
        await asyncio.sleep(3600)


@asynccontextmanager
async def lifespan(app: FastAPI):
    signal_db.init_db()
    _prev_recs.update(signal_db.load_prev_recs())
    await coin_registry.fetch_and_build_registry(limit=30)
    t1 = asyncio.create_task(analysis_loop())
    t2 = asyncio.create_task(forex_loop())
    t3 = asyncio.create_task(_outcome_loop())
    yield
    t1.cancel(); t2.cancel(); t3.cancel()


app = FastAPI(title="Trading Platform API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _broadcast(payload: str):
    dead = []
    for ws in active_connections:
        try:
            await ws.send_text(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        active_connections.remove(ws)


async def _notify_signals(new_data: dict, market: str, name_fn):
    """Send Telegram alerts for symbols that transition to BUY or SELL."""
    tasks = []
    for symbol, data in new_data.items():
        synth = data.get("synthesis", {})
        rec   = synth.get("recommendation", "")
        prev  = _prev_recs.get(symbol, "")

        if rec in ("BUY", "STRONG_BUY", "SELL", "STRONG_SELL") and rec != prev:
            price = data.get("price") or 0.0
            rd    = synth.get("risk_details") or {}
            sl    = rd.get("suggested_stop_loss")
            tp    = rd.get("suggested_take_profit")
            conf  = synth.get("confidence", 0.5)
            name  = name_fn(symbol) or symbol
            tasks.append(telegram.send_signal(symbol, name, rec, price, sl, tp, conf, market))

        _prev_recs[symbol] = rec

    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)
    signal_db.save_prev_recs(_prev_recs)


# ── Crypto ─────────────────────────────────────────────────────────

async def run_all_agents(symbol: str) -> dict:
    results = await asyncio.gather(
        fundamental.run(symbol), technical.run(symbol),
        news.run(symbol), risk.run(symbol),
        return_exceptions=True,
    )
    fund = _safe_agent(results[0], "fundamental", symbol)
    tech = _safe_agent(results[1], "technical",   symbol)
    n    = _safe_agent(results[2], "news",         symbol)
    r    = _safe_agent(results[3], "risk",         symbol)
    synth = await synthesis.run(symbol, [fund, tech, n, r], market="crypto")
    price = tech.get("details", {}).get("close") or fund.get("details", {}).get("current_price")
    change_24h = fund.get("details", {}).get("price_change_24h_pct")
    yahoo_sym  = symbol.replace("USDT", "") + "-USD"
    signal_db.save_signal(symbol, yahoo_sym, "crypto", synth, tech.get("details") or {}, price, [fund, tech, n, r])
    return {
        "symbol": symbol,
        "price": price,
        "price_change_24h": change_24h,
        "agents": {"fundamental": fund, "technical": tech, "news": n, "risk": r},
        "synthesis": synth,
    }


async def _do_refresh():
    if _refresh_lock.locked(): return
    async with _refresh_lock:
        await _broadcast(json.dumps({"type": "refreshing"}))
        try:
            results = await asyncio.gather(*[run_all_agents(s) for s in coin_registry.get_symbols()], return_exceptions=True)
            for r in results:
                if not isinstance(r, Exception): latest_data[r["symbol"]] = r
        except Exception: pass
        await _broadcast(json.dumps({"type": "update", "data": latest_data}))
        def _crypto_name(sym): c = coin_registry.get_by_binance(sym); return c["name"] if c else sym
        await _notify_signals(latest_data, "crypto", _crypto_name)


async def analysis_loop():
    while True:
        await asyncio.sleep(AUTO_REFRESH_INTERVAL)
        await _do_refresh()


# ── Forex ──────────────────────────────────────────────────────────

def _safe_agent(result, agent_name: str, pair_id: str) -> dict:
    """Wraps an asyncio.gather result that may be an Exception."""
    if isinstance(result, Exception):
        msg = str(result).strip() or type(result).__name__
        return {"agent": agent_name, "symbol": pair_id,
                "score": 0, "details": {}, "signal": "NEUTRAL", "error": msg}
    return result


async def run_forex_agents(pair_id: str) -> dict:
    results = await asyncio.gather(
        forex_fundamental.run(pair_id), forex_technical.run(pair_id),
        forex_news.run(pair_id), forex_risk.run(pair_id),
        forex_cot.run(pair_id),
        return_exceptions=True,
    )
    fund = _safe_agent(results[0], "fundamental", pair_id)
    tech = _safe_agent(results[1], "technical",   pair_id)
    n    = _safe_agent(results[2], "news",         pair_id)
    r    = _safe_agent(results[3], "risk",         pair_id)
    cot  = _safe_agent(results[4], "cot",          pair_id)
    synth   = await synthesis.run(pair_id, [fund, tech, n, r, cot], market="forex")
    details = tech.get("details", {}) if not tech.get("error") else {}
    pair_info = forex_registry.get_by_id(pair_id)
    yahoo_sym = pair_info["yahoo"] if pair_info else pair_id
    signal_db.save_signal(pair_id, yahoo_sym, "forex", synth, details, details.get("close"), [fund, tech, n, r, cot])
    return {
        "symbol": pair_id,
        "price": details.get("close"),
        "price_change_24h": details.get("price_change_24h_pct"),
        "agents": {"fundamental": fund, "technical": tech, "news": n, "risk": r, "cot": cot},
        "synthesis": synth,
    }


async def _do_forex_refresh():
    if _forex_lock.locked(): return
    async with _forex_lock:
        await _broadcast(json.dumps({"type": "forex_refreshing"}))
        try:
            results = await asyncio.gather(*[run_forex_agents(p) for p in forex_registry.get_ids()], return_exceptions=True)
            for r in results:
                if not isinstance(r, Exception): latest_forex[r["symbol"]] = r
        except Exception: pass
        _inject_correlation_notes(latest_forex)
        await _broadcast(json.dumps({"type": "forex_update", "data": latest_forex}))
        def _forex_name(sym): p = forex_registry.get_by_id(sym); return p["name"] if p else sym
        await _notify_signals(latest_forex, "forex", _forex_name)


# ── Correlation groups: pairs that share the same underlying risk ──────────────
# Within a group, if ALL pairs signal the same direction the trader is
# taking on the same risk multiple times — flag it in the reasoning.
_CORR_GROUPS: list[list[str]] = [
    ["EURUSD", "GBPUSD"],          # both price USD weakness
    ["USDJPY", "USDCHF"],          # both price safe-haven demand
    ["AUDUSD", "NZDUSD"],          # both commodity-linked vs USD
    ["EURUSD", "EURJPY", "EURGBP"],# all carry EUR exposure
]


def _inject_correlation_notes(data: dict) -> None:
    """Add a correlation_note to synthesis if a group is unanimously directional."""
    for group in _CORR_GROUPS:
        recs = [data.get(s, {}).get("synthesis", {}).get("recommendation", "") for s in group]
        recs = [r for r in recs if r]
        if len(recs) < 2:
            continue
        buys  = sum(1 for r in recs if "BUY"  in r)
        sells = sum(1 for r in recs if "SELL" in r)
        if buys < len(recs) and sells < len(recs):
            continue   # mixed signals — no warning needed
        direction = "rialzista" if buys == len(recs) else "ribassista"
        note = f" [rischio correlato: {' + '.join(group)} tutti {direction}]"
        for s in group:
            if s in data and data[s].get("synthesis"):
                data[s]["synthesis"]["correlation_note"] = note


async def forex_loop():
    await asyncio.sleep(30)
    while True:
        await asyncio.sleep(AUTO_REFRESH_INTERVAL)
        await _do_forex_refresh()


# ── API endpoints ──────────────────────────────────────────────────

@app.get("/api/data")
async def get_data(): return latest_data

@app.get("/api/coins")
async def get_coins(): return coin_registry.get_registry()

@app.get("/api/symbols")
async def get_symbols(): return coin_registry.get_symbols()

@app.post("/api/refresh")
async def force_refresh():
    if _refresh_lock.locked(): return {"status": "already_running"}
    asyncio.create_task(_do_refresh())
    return {"status": "started"}

@app.get("/api/forex/data")
async def get_forex_data(): return latest_forex

@app.get("/api/forex/pairs")
async def get_forex_pairs(): return forex_registry.get_all()

@app.post("/api/forex/refresh")
async def force_forex_refresh():
    if _forex_lock.locked(): return {"status": "already_running"}
    asyncio.create_task(_do_forex_refresh())
    return {"status": "started"}


async def _yahoo_ohlcv(symbol: str, interval: str, limit: int) -> list:
    """Shared Yahoo Finance OHLCV proxy used by forex and crypto endpoints."""
    yahoo_sym = symbol
    interval_map = {"1h": ("60m","5d"), "4h": ("60m","14d"), "1d": ("1d","90d"), "1w": ("1wk","2y")}
    y_interval, y_range = interval_map.get(interval, ("60m", "5d"))
    try:
        async with httpx.AsyncClient(timeout=12, headers=YAHOO_HEADERS) as client:
            r = await client.get(f"{YAHOO_BASE}/{yahoo_sym}?interval={y_interval}&range={y_range}")
            r.raise_for_status()
            result = r.json()
        data = result["chart"]["result"][0]
        q = data["indicators"]["quote"][0]
        rows = [
            {"ts": int(ts * 1000), "o": o, "h": h, "l": l, "c": c}
            for ts, o, h, l, c in zip(data["timestamp"], q.get("open",[]), q.get("high",[]), q.get("low",[]), q.get("close",[]))
            if c is not None
        ]
        if interval == "4h" and rows:
            df = pd.DataFrame(rows)
            df["dt"] = pd.to_datetime(df["ts"], unit="ms")
            df = df.set_index("dt")
            df4 = df.resample("4h").agg({"o":"first","h":"max","l":"min","c":"last","ts":"first"}).dropna()
            rows = [{"ts": int(row["ts"]), "o": row["o"], "h": row["h"], "l": row["l"], "c": row["c"]} for _, row in df4.iterrows()]
        return rows[-limit:]
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get("/api/forex/ohlcv")
async def forex_ohlcv(symbol: str = Query(...), interval: str = "1h", limit: int = 48):
    return await _yahoo_ohlcv(symbol, interval, limit)



@app.get("/api/crypto/ohlcv")
async def crypto_ohlcv(symbol: str = Query(...), interval: str = "1h", limit: int = 48):
    # Reuse the same Yahoo Finance proxy already used for forex
    yahoo_sym = symbol.replace("USDT", "") + "-USD"
    rows = await _yahoo_ohlcv(yahoo_sym, interval, limit)
    return [{"t": r["ts"], "c": r["c"]} for r in rows]


@app.get("/api/signals")
async def get_signals(limit: int = 200,
                      market: str | None = None,
                      action: str | None = None):
    """Recent signals with 4h/24h outcomes — feeds the history dashboard."""
    return signal_db.get_recent_signals(limit=limit, market=market, action=action)


@app.get("/api/accuracy")
async def get_accuracy():
    """Global signal accuracy statistics — feeds the learning dashboard."""
    return signal_db.get_all_stats()


@app.get("/api/accuracy/{symbol}")
async def get_symbol_accuracy(symbol: str):
    stats = {
        "overall":    signal_db.get_accuracy_stats(symbol=symbol),
        "trending":   signal_db.get_accuracy_stats(symbol=symbol, regime="trending"),
        "ranging":    signal_db.get_accuracy_stats(symbol=symbol, regime="ranging"),
        "multiplier": signal_db.get_confidence_multiplier(symbol, "transitional"),
    }
    return stats


@app.get("/api/agent-stats")
async def get_agent_stats():
    """Per-agent accuracy stats — feeds the learning dashboard."""
    return signal_db.get_agent_stats()


@app.post("/api/check-outcomes")
async def force_outcome_check():
    """Manually trigger outcome evaluation (useful for testing)."""
    saved = await outcome_checker.check_pending_outcomes()
    return {"outcomes_saved": saved}


@app.get("/api/signals/chart/{market}")
async def get_signal_chart(market: str):
    if market not in ("crypto", "forex"):
        raise HTTPException(status_code=400, detail="Market deve essere crypto o forex")
    return signal_db.get_chart_data(market)


@app.post("/api/signals/cleanup")
async def cleanup_signals():
    deleted = signal_db.cleanup_incomplete_signals()
    return {"deleted": deleted}


@app.get("/api/backtest")
async def get_backtest(market: str | None = None):
    """Simulated P&L from recorded signals and outcomes."""
    if market and market not in ("crypto", "forex"):
        raise HTTPException(status_code=400, detail="Market deve essere crypto o forex")
    return signal_db.get_backtest_summary(market=market)


ALLOWED_ARTICLE_DOMAINS = {
    "cointelegraph.com", "decrypt.co",            # crypto
    "forexlive.com", "fxstreet.com", "reuters.com",  # forex/macro
}


@app.get("/api/article")
async def get_article(url: str = Query(...)):
    parsed = urlparse(url)
    domain = parsed.netloc.lower().lstrip("www.")
    if domain not in ALLOWED_ARTICLE_DOMAINS:
        raise HTTPException(status_code=403, detail="Dominio non consentito")
    try:
        hdrs = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"}
        async with httpx.AsyncClient(timeout=12, headers=hdrs, follow_redirects=True) as client:
            r = await client.get(url)
            r.raise_for_status()
            html = r.text
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Impossibile recuperare l'articolo: {e}")

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "header", "footer", "aside", "figure", "iframe", "noscript", "button", "form"]):
        tag.decompose()
    content = soup.find("article") or soup.find("main") or soup.find("body")
    paragraphs = [p.get_text(" ", strip=True) for p in (content or soup).find_all("p") if len(p.get_text(" ", strip=True)) > 40]
    og = soup.find("meta", property="og:title")
    title = og.get("content", "") if og else ""
    if not title and (h1 := soup.find("h1")): title = h1.get_text(strip=True)
    time_el = soup.find("time")
    published = time_el.get("datetime", "") if time_el else ""
    return {"title": title, "paragraphs": paragraphs[:30], "published": published, "source_url": url}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    if latest_data:
        await websocket.send_text(json.dumps({"type": "update", "data": latest_data}))
    if latest_forex:
        await websocket.send_text(json.dumps({"type": "forex_update", "data": latest_forex}))
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        try:
            active_connections.remove(websocket)
        except ValueError:
            pass
