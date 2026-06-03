from agents.forex_technical import fetch_ohlcv
from data.commodities import get_by_id


async def run(commodity_id: str) -> dict:
    comm = get_by_id(commodity_id)
    if not comm:
        return _err(commodity_id, "Commodity non trovata")
    try:
        df = await fetch_ohlcv(comm["id"], interval="1d", yrange="90d")
        if df.empty:
            return _err(commodity_id, "Nessun dato storico")

        close   = df["close"].astype(float)
        current = float(close.iloc[-1])

        def pct(n: int) -> float | None:
            if len(close) < n:
                return None
            past = float(close.iloc[-n])
            return round((current - past) / past * 100, 3) if past else None

        p7d  = pct(7)
        p30d = pct(30)
        p90d = pct(min(90, len(close) - 1))

        score = _compute_score(p7d, p30d, p90d)

        return {
            "agent": "fundamental",
            "symbol": commodity_id,
            "score": score,
            "details": {
                "prezzo_attuale": round(current, 2),
                "cambio_7g_pct":  p7d,
                "cambio_30g_pct": p30d,
                "cambio_90g_pct": p90d,
                "unita":          comm["unit"],
            },
            "signal": _sig(score),
            "error": None,
        }
    except Exception as e:
        return _err(commodity_id, str(e))


def _compute_score(p7d, p30d, p90d) -> float:
    parts = []
    if p7d  is not None: parts.append(max(-1.0, min(1.0, p7d  / 3.0)))
    if p30d is not None: parts.append(max(-1.0, min(1.0, p30d / 8.0)))
    if p90d is not None: parts.append(max(-1.0, min(1.0, p90d / 15.0)))
    return round(sum(parts) / max(len(parts), 1), 3)


def _sig(score: float) -> str:
    if score > 0.3:  return "BUY"
    if score < -0.3: return "SELL"
    return "NEUTRAL"


def _err(cid: str, msg: str) -> dict:
    return {"agent": "fundamental", "symbol": cid, "score": 0, "details": {}, "signal": "NEUTRAL", "error": msg}
