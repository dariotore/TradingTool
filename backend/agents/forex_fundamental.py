import httpx
from datetime import date, timedelta
from data.forex import get_by_id

FRANKFURTER = "https://api.frankfurter.app"


async def run(pair_id: str) -> dict:
    pair = get_by_id(pair_id)
    if not pair:
        return _err(pair_id, "Coppia non trovata")

    base, quote = pair["base"], pair["quote"]
    try:
        today = date.today()
        start = (today - timedelta(days=60)).isoformat()

        async with httpx.AsyncClient(timeout=12, follow_redirects=True, headers={"User-Agent": "TradingPlatform/1.0"}) as client:
            r = await client.get(f"{FRANKFURTER}/{start}..{today.isoformat()}", params={"from": base, "to": quote})
            r.raise_for_status()
            hist = r.json()

        rates = {d: v[quote] for d, v in hist.get("rates", {}).items() if quote in v}
        if not rates:
            return _err(pair_id, "Nessun dato da Frankfurter")

        sorted_dates = sorted(rates.keys())
        current_rate = rates[sorted_dates[-1]]

        def pct_change(n_days: int) -> float | None:
            target = (today - timedelta(days=n_days)).isoformat()
            past = next((rates[d] for d in sorted_dates if d >= target), None)
            if past and past != 0:
                return round((current_rate - past) / past * 100, 3)
            return None

        p7d = pct_change(7)
        p30d = pct_change(30)
        p60d = pct_change(60)

        score = _compute_score(p7d, p30d, p60d)

        return {
            "agent": "fundamental",
            "symbol": pair_id,
            "score": score,
            "details": {
                "tasso_attuale": round(current_rate, 5),
                "cambio_7g_pct": p7d,
                "cambio_30g_pct": p30d,
                "cambio_60g_pct": p60d,
                "base": base,
                "quote": quote,
                "fonte": "ECB / Frankfurter",
            },
            "signal": _sig(score),
            "error": None,
        }
    except Exception as e:
        return _err(pair_id, str(e))


def _compute_score(p7d, p30d, p60d) -> float:
    scores = []
    if p7d  is not None: scores.append(max(-1.0, min(1.0, p7d  / 1.5)))
    if p30d is not None: scores.append(max(-1.0, min(1.0, p30d / 3.0)))
    if p60d is not None: scores.append(max(-1.0, min(1.0, p60d / 5.0)))
    return round(sum(scores) / max(len(scores), 1), 3)


def _sig(score: float) -> str:
    if score > 0.3:  return "BUY"
    if score < -0.3: return "SELL"
    return "NEUTRAL"


def _err(pair_id: str, msg: str) -> dict:
    return {"agent": "fundamental", "symbol": pair_id, "score": 0, "details": {}, "signal": "NEUTRAL", "error": msg}
