import httpx
from data import coins as coin_registry
from utils import price_history, yahoo_history


async def run(symbol: str) -> dict:
    coin = coin_registry.get_by_binance(symbol)
    if not coin:
        return {"agent": "fundamental", "symbol": symbol, "score": 0,
                "details": {}, "signal": "NEUTRAL", "error": "Coin not in registry"}

    try:
        # Fetch price data + sentiment signals concurrently
        series, fg_value, fg_label, funding_rate = await _fetch_all(symbol)

        if series is None or len(series) < 2:
            raise ValueError("Not enough price data")

        current_price = float(series.iloc[-1])
        price_history.push(coin["id"], current_price)

        # Price momentum at 24h / 7d / 30d
        idx_24h       = max(0, len(series) - 25)
        price_24h_ago = float(series.iloc[idx_24h])
        change_24h    = round((current_price / price_24h_ago - 1) * 100, 2) if price_24h_ago else 0

        change_7d = None
        if len(series) >= 169:
            change_7d = round((current_price / float(series.iloc[-169]) - 1) * 100, 2)

        change_30d = None
        if len(series) >= 720:
            change_30d = round((current_price / float(series.iloc[-720]) - 1) * 100, 2)
        elif len(series) > 24:
            change_30d = round((current_price / float(series.iloc[0]) - 1) * 100, 2)

        volume = yahoo_history.get_last_volume(symbol)
        score  = _compute_score(change_24h, change_7d or 0, change_30d or 0, fg_value, funding_rate)

        return {
            "agent":   "fundamental",
            "symbol":  symbol,
            "score":   score,
            "details": {
                "market_cap_rank":      coin.get("market_cap_rank"),
                "current_price":        round(current_price, 4),
                "price_change_24h_pct": change_24h,
                "price_change_7d_pct":  change_7d,
                "price_change_30d_pct": change_30d,
                "total_volume_usd":     volume,
                "fear_greed":           fg_value,
                "fear_greed_label":     fg_label,
                "funding_rate":         funding_rate,
            },
            "signal": _signal(score),
            "error":  None,
        }
    except Exception as e:
        return {"agent": "fundamental", "symbol": symbol, "score": 0,
                "details": {}, "signal": "NEUTRAL", "error": str(e)}


# ── Data fetchers ─────────────────────────────────────────────────────────────

async def _fetch_all(symbol: str):
    """Fetch price series, Fear & Greed, and funding rate concurrently."""
    import asyncio
    results = await asyncio.gather(
        yahoo_history.get_close_series(symbol, days=30),
        _fetch_fear_greed(),
        _fetch_funding_rate(symbol),
        return_exceptions=True,
    )
    series  = results[0] if not isinstance(results[0], Exception) else None
    fg      = results[1] if not isinstance(results[1], Exception) else (50, "Neutral")
    funding = results[2] if not isinstance(results[2], Exception) else None
    fg_val, fg_lbl = fg if isinstance(fg, tuple) else (50, "Neutral")
    return series, int(fg_val), str(fg_lbl), funding


async def _fetch_fear_greed() -> tuple[int, str]:
    """Fear & Greed Index (0–100). Source: alternative.me — no API key."""
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get("https://api.alternative.me/fng/?limit=1")
            r.raise_for_status()
            d = r.json()["data"][0]
            return int(d["value"]), d["value_classification"]
    except Exception:
        return 50, "Neutral"


async def _fetch_funding_rate(symbol: str) -> float | None:
    """Latest perpetual futures funding rate from Binance (no API key)."""
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(
                "https://fapi.binance.com/fapi/v1/fundingRate",
                params={"symbol": symbol, "limit": 1},
            )
            r.raise_for_status()
            data = r.json()
            return float(data[0]["fundingRate"]) if data else None
    except Exception:
        return None  # not all coins have futures listings


# ── Score computation ─────────────────────────────────────────────────────────

def _compute_score(
    change_24h: float,
    change_7d:  float,
    change_30d: float,
    fg_value:   int   = 50,
    funding:    float | None = None,
) -> float:
    # ── Price momentum (70% of final score) ──
    s24  = max(-1.0, min(1.0, change_24h / 5))
    s7d  = max(-1.0, min(1.0, change_7d  / 15))
    s30d = max(-1.0, min(1.0, change_30d / 30))
    momentum = s24 * 0.5 + s7d * 0.3 + s30d * 0.2

    # ── Fear & Greed (contrarian, 20% of final score) ──
    # Extreme fear = potential buy; extreme greed = potential sell
    if   fg_value <= 20: fg_s = +0.8
    elif fg_value <= 35: fg_s = +0.4
    elif fg_value <= 50: fg_s = +0.1
    elif fg_value <= 65: fg_s = -0.1
    elif fg_value <= 80: fg_s = -0.4
    else:                fg_s = -0.8

    # ── Funding rate (contrarian, 10% of final score) ──
    # High positive funding = market too long = bearish signal
    fr_s = 0.0
    if funding is not None:
        if   funding >  0.002:  fr_s = -0.8
        elif funding >  0.001:  fr_s = -0.4
        elif funding >  0.0005: fr_s = -0.1
        elif funding < -0.002:  fr_s = +0.8
        elif funding < -0.001:  fr_s = +0.4
        elif funding < -0.0005: fr_s = +0.1

    sentiment = fg_s * 0.20 + fr_s * 0.10
    return round(max(-1.0, min(1.0, momentum * 0.70 + sentiment)), 3)


def _signal(score: float) -> str:
    if score > 0.3:  return "BUY"
    if score < -0.3: return "SELL"
    return "NEUTRAL"
