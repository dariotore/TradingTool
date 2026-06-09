"""
Yahoo Finance historical prices for crypto (BTC-USD, ETH-USD, …).
- Up to 3 attempts per request with exponential back-off (0.5 s → 1.5 s).
- On all-retry failure the most recent cached DataFrame is returned so the
  analysis loop keeps working with slightly stale data rather than crashing.
"""
import asyncio
import time
import httpx
import pandas as pd

YAHOO_BASE    = "https://query1.finance.yahoo.com/v8/finance/chart"
YAHOO_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
    )
}

_cache: dict = {}
TTL           = 60       # seconds — hourly data
TTL_DAILY     = 600      # 10 min — daily bars
_RETRY_WAITS  = [0.5, 1.5]  # seconds before 2nd and 3rd attempt


def _binance_to_yahoo(symbol: str) -> str:
    return symbol.replace("USDT", "") + "-USD"


async def _fetch_json(url: str) -> dict:
    """GET url with up to 3 attempts. Raises last exception if all fail."""
    last_exc: Exception | None = None
    for wait in [None, *_RETRY_WAITS]:
        if wait:
            await asyncio.sleep(wait)
        try:
            async with httpx.AsyncClient(timeout=15, headers=YAHOO_HEADERS) as client:
                r = await client.get(url)
                r.raise_for_status()
                return r.json()
        except Exception as exc:
            last_exc = exc
    raise last_exc  # type: ignore[misc]


def _parse_ohlcv(raw: dict) -> pd.DataFrame:
    res = raw["chart"]["result"][0]
    q   = res["indicators"]["quote"][0]
    rows = [
        {"open": o or c, "high": h or c, "low": l or c, "close": c, "volume": v or 0.0}
        for o, h, l, c, v in zip(
            q.get("open",   []), q.get("high",   []),
            q.get("low",    []), q.get("close",  []),
            q.get("volume", []),
        )
        if c is not None
    ]
    return pd.DataFrame(rows)


# ── Public API ────────────────────────────────────────────────────────────────

async def get_close_series(binance_symbol: str, days: int = 5) -> pd.Series:
    yahoo_sym = _binance_to_yahoo(binance_symbol)
    hit       = _cache.get(yahoo_sym)
    if hit and time.time() - hit["ts"] < TTL:
        return hit["data"]
    try:
        raw     = await _fetch_json(f"{YAHOO_BASE}/{yahoo_sym}?interval=60m&range={days}d")
        result  = raw["chart"]["result"][0]
        q0      = result["indicators"]["quote"][0]
        closes  = [c for c in q0.get("close",  []) if c is not None]
        volumes = [v for v in q0.get("volume", []) if v is not None]
        series  = pd.Series(closes)
        _cache[yahoo_sym] = {"data": series, "ts": time.time(),
                             "last_volume": volumes[-1] if volumes else 0}
        return series
    except Exception:
        if hit:
            return hit["data"]      # serve stale rather than crashing
        return pd.Series(dtype=float)


async def get_ohlcv(binance_symbol: str, days: int = 30) -> "pd.DataFrame | None":
    """Hourly OHLCV DataFrame. Returns stale cache on fetch failure."""
    yahoo_sym = _binance_to_yahoo(binance_symbol)
    cache_key = f"ohlcv:{yahoo_sym}"
    hit       = _cache.get(cache_key)
    if hit and time.time() - hit["ts"] < TTL:
        return hit["data"]
    try:
        raw = await _fetch_json(f"{YAHOO_BASE}/{yahoo_sym}?interval=60m&range={days}d")
        df  = _parse_ohlcv(raw)
        if not df.empty:
            _cache[cache_key] = {"data": df, "ts": time.time()}
            return df
    except Exception:
        pass
    return hit["data"] if hit else None


async def get_ohlcv_daily(binance_symbol: str, days: int = 90) -> "pd.DataFrame | None":
    """Daily OHLCV DataFrame for the MTF filter. Returns stale cache on failure."""
    yahoo_sym = _binance_to_yahoo(binance_symbol)
    cache_key = f"ohlcv_daily:{yahoo_sym}"
    hit       = _cache.get(cache_key)
    if hit and time.time() - hit["ts"] < TTL_DAILY:
        return hit["data"]
    try:
        raw = await _fetch_json(f"{YAHOO_BASE}/{yahoo_sym}?interval=1d&range={days}d")
        df  = _parse_ohlcv(raw)
        if not df.empty:
            _cache[cache_key] = {"data": df, "ts": time.time()}
            return df
    except Exception:
        pass
    return hit["data"] if hit else None


def get_last_volume(binance_symbol: str) -> float:
    hit = _cache.get(_binance_to_yahoo(binance_symbol))
    return hit["last_volume"] if hit else 0
