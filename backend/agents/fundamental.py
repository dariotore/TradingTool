import asyncio
import time
import httpx
from data import coins as coin_registry

COINGECKO_BASE = "https://api.coingecko.com/api/v3"

_cache: dict[str, dict] = {}  # {coin_id -> market_data}
_cache_ts: float = 0
_cache_lock = asyncio.Lock()
_CACHE_TTL = 28


async def _refresh_cache():
    global _cache, _cache_ts
    ids = [c["id"] for c in coin_registry.get_registry()]
    if not ids:
        return
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"{COINGECKO_BASE}/coins/markets", params={
            "vs_currency": "usd",
            "ids": ",".join(ids),
            "order": "market_cap_desc",
            "per_page": 20,
            "page": 1,
            "sparkline": "false",
            "price_change_percentage": "24h,7d,30d",
        })
        r.raise_for_status()
        data = r.json()
    _cache = {c["id"]: c for c in data}
    _cache_ts = time.time()


async def _get_coin_data(coin_id: str) -> dict | None:
    global _cache_ts
    async with _cache_lock:
        if time.time() - _cache_ts > _CACHE_TTL:
            await _refresh_cache()
    return _cache.get(coin_id)


async def run(symbol: str) -> dict:
    coin = coin_registry.get_by_binance(symbol)
    if not coin:
        return {"agent": "fundamental", "symbol": symbol, "score": 0, "details": {}, "signal": "NEUTRAL", "error": "Coin not in registry"}

    coin_id = coin["id"]
    try:
        data = await _get_coin_data(coin_id)
        if not data:
            raise ValueError(f"No data for {coin_id}")

        score = _compute_score(data)
        return {
            "agent": "fundamental",
            "symbol": symbol,
            "score": score,
            "details": {
                "market_cap_rank": data.get("market_cap_rank"),
                "price_change_24h_pct": round(data.get("price_change_percentage_24h_in_currency") or data.get("price_change_percentage_24h") or 0, 2),
                "price_change_7d_pct": round(data.get("price_change_percentage_7d_in_currency") or 0, 2),
                "price_change_30d_pct": round(data.get("price_change_percentage_30d_in_currency") or 0, 2),
                "market_cap_usd": data.get("market_cap"),
                "total_volume_usd": data.get("total_volume"),
                "ath_change_pct": round(data.get("ath_change_percentage") or 0, 2),
            },
            "signal": _signal(score),
            "error": None,
        }
    except Exception as e:
        return {"agent": "fundamental", "symbol": symbol, "score": 0, "details": {}, "signal": "NEUTRAL", "error": str(e)}


def _compute_score(data: dict) -> float:
    p24 = data.get("price_change_percentage_24h_in_currency") or data.get("price_change_percentage_24h") or 0
    p7d = data.get("price_change_percentage_7d_in_currency") or 0
    p30d = data.get("price_change_percentage_30d_in_currency") or 0

    score = (
        max(-1.0, min(1.0, p24 / 5))
        + max(-1.0, min(1.0, p7d / 15))
        + max(-1.0, min(1.0, p30d / 30))
    )
    return round(score / 3, 3)


def _signal(score: float) -> str:
    if score > 0.3:
        return "BUY"
    if score < -0.3:
        return "SELL"
    return "NEUTRAL"
