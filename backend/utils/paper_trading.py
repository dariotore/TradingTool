"""
Paper-trading background tasks.
Periodically checks open paper trades against live prices
and auto-closes when SL or TP is hit.
"""
import asyncio
import httpx
from utils import signal_db

YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart"
_HEADERS   = {"User-Agent": "Mozilla/5.0"}


async def _price(yahoo_symbol: str) -> float | None:
    sym = yahoo_symbol.replace("=", "%3D")
    url = f"{YAHOO_BASE}/{sym}?interval=1h&range=1d"
    try:
        async with httpx.AsyncClient(timeout=10, headers=_HEADERS) as c:
            r = await c.get(url)
            r.raise_for_status()
        closes = r.json()["chart"]["result"][0]["indicators"]["quote"][0]["close"]
        closes = [x for x in closes if x is not None]
        return float(closes[-1]) if closes else None
    except Exception:
        return None


async def check_paper_trades() -> int:
    """Fetch prices for open trades, close any that hit SL or TP. Returns count closed."""
    trades = signal_db.get_all_open_paper_trades()
    closed = 0
    for trade in trades:
        price = await _price(trade["yahoo_symbol"])
        if price is None:
            continue
        d   = trade["direction"]
        sl  = trade["sl_price"]
        tp  = trade["tp_price"]
        hit = None
        if d == "BUY":
            if sl and price <= sl:  hit = "SL"
            elif tp and price >= tp: hit = "TP"
        else:
            if sl and price >= sl:  hit = "SL"
            elif tp and price <= tp: hit = "TP"
        if hit:
            signal_db.close_paper_trade(trade["id"], price, hit)
            closed += 1
        await asyncio.sleep(0.3)
    return closed


async def close_trade_now(trade_id: int) -> dict:
    """Fetch current price and manually close a specific trade."""
    trades = signal_db.get_all_open_paper_trades()
    trade  = next((t for t in trades if t["id"] == trade_id), None)
    if not trade:
        return {}
    price = await _price(trade["yahoo_symbol"])
    if not price:
        return {"error": "price_unavailable"}
    result = signal_db.close_paper_trade(trade_id, price, "MANUAL")
    return {"close_price": price, **result}
