import time
import httpx

COINGECKO_BASE = "https://api.coingecko.com/api/v3"
_cache: dict = {}
TTL = 900  # 15 minutes


def _cached(key: str):
    entry = _cache.get(key)
    if entry and time.time() - entry["ts"] < TTL:
        return entry["data"]
    return None


def _store(key: str, data):
    _cache[key] = {"data": data, "ts": time.time()}
    return data


async def market_chart(coin_id: str, days: int) -> list:
    key = f"chart:{coin_id}:{days}"
    if (hit := _cached(key)) is not None:
        return hit
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{COINGECKO_BASE}/coins/{coin_id}/market_chart",
            params={"vs_currency": "usd", "days": days, "interval": "hourly"},
            headers={"accept": "application/json"},
        )
        r.raise_for_status()
    return _store(key, r.json().get("prices", []))


async def ohlc(coin_id: str, days: int) -> list:
    key = f"ohlc:{coin_id}:{days}"
    if (hit := _cached(key)) is not None:
        return hit
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{COINGECKO_BASE}/coins/{coin_id}/ohlc",
            params={"vs_currency": "usd", "days": days},
            headers={"accept": "application/json"},
        )
        r.raise_for_status()
    return _store(key, r.json())
