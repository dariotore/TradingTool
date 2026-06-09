"""
Batch quote fetcher from Yahoo Finance.
One HTTP call for all 30 crypto symbols — no API key, no rate limits.
"""
import time
import httpx

YAHOO_HEADERS = {"User-Agent": "Mozilla/5.0"}
_cache: dict = {}
TTL = 28  # seconds


async def fetch_all(yahoo_symbols: list[str]) -> dict[str, dict]:
    """Returns dict keyed by Yahoo symbol e.g. {'BTC-USD': {...}, ...}"""
    hit = _cache.get("quotes")
    if hit and time.time() - hit["ts"] < TTL:
        return hit["data"]

    async with httpx.AsyncClient(timeout=15, headers=YAHOO_HEADERS) as client:
        r = await client.get(
            "https://query2.finance.yahoo.com/v7/finance/quote",
            params={"symbols": ",".join(yahoo_symbols)},
        )
        r.raise_for_status()

    results = r.json().get("quoteResponse", {}).get("result", [])
    data = {q["symbol"]: q for q in results}
    _cache["quotes"] = {"data": data, "ts": time.time()}
    return data
