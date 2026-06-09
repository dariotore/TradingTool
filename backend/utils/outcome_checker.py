"""
Background task: fetch current prices for signals that have reached
their 4h or 24h checkpoint and persist the outcome (correct/wrong direction).
"""
import asyncio
import httpx
from utils import signal_db

YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart"
_HEADERS   = {"User-Agent": "Mozilla/5.0"}


async def _fetch_last_price(yahoo_symbol: str) -> float | None:
    sym = yahoo_symbol.replace("=", "%3D")
    url = f"{YAHOO_BASE}/{sym}?interval=1h&range=2d"
    try:
        async with httpx.AsyncClient(timeout=10, headers=_HEADERS) as c:
            r = await c.get(url)
            r.raise_for_status()
        closes = r.json()["chart"]["result"][0]["indicators"]["quote"][0]["close"]
        closes = [x for x in closes if x is not None]
        return float(closes[-1]) if closes else None
    except Exception:
        return None


async def check_pending_outcomes() -> int:
    """
    Evaluate all pending signals and persist outcomes.
    Returns the total number of outcomes saved in this run.
    """
    pending = signal_db.get_pending_checks()
    saved   = 0

    for sig in pending:
        price = await _fetch_last_price(sig["yahoo_symbol"])
        if price is None:
            continue

        for period in sig["needed_periods"]:
            signal_db.save_outcome(
                sig["id"], period,
                price, sig["price_at_signal"], sig["action"],
            )
            saved += 1

        await asyncio.sleep(0.3)   # gentle rate-limit between fetches

    return saved
