import httpx
from datetime import date, timedelta
from data.forex import get_by_id

FRANKFURTER = "https://api.frankfurter.app"
YAHOO_BASE  = "https://query1.finance.yahoo.com/v8/finance/chart"
YAHOO_HDR   = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

# Currencies not supported by Frankfurter/ECB → use Yahoo price momentum
_YAHOO_ONLY = {"XAU", "XAG", "XPT", "XPD"}

# ── Central bank policy rates ─────────────────────────────────────────────────
# UPDATE THESE after each central bank meeting.
# Sources: federalreserve.gov, ecb.europa.eu, bankofengland.co.uk,
#          boj.or.jp, snb.ch, rba.gov.au, bankofcanada.ca, rbnz.govt.nz
_CB_RATES: dict[str, float] = {
    "USD": 4.50,   # Fed Funds Rate upper bound
    "EUR": 2.50,   # ECB deposit facility rate
    "GBP": 4.25,   # Bank of England base rate
    "JPY": 0.50,   # Bank of Japan policy rate
    "CHF": 0.50,   # Swiss National Bank policy rate
    "AUD": 3.85,   # Reserve Bank of Australia cash rate
    "CAD": 3.00,   # Bank of Canada overnight rate
    "NZD": 3.25,   # RBNZ official cash rate
    "XAU": 0.00,   # Gold: no yield (pure opportunity cost)
}
_MAX_RATE_DIFF = 8.0   # normalisation ceiling (±8% maps to ±1.0)


async def run(pair_id: str) -> dict:
    pair = get_by_id(pair_id)
    if not pair:
        return _err(pair_id, "Coppia non trovata")

    base, quote = pair["base"], pair["quote"]

    # Gold and other precious metals: ECB doesn't publish these rates
    if base in _YAHOO_ONLY or quote in _YAHOO_ONLY:
        return await _yahoo_momentum(pair_id, pair["yahoo"], base, quote)

    try:
        today = date.today()
        start = (today - timedelta(days=60)).isoformat()

        async with httpx.AsyncClient(timeout=12, follow_redirects=True,
                                     headers={"User-Agent": "TradingPlatform/1.0"}) as client:
            r = await client.get(
                f"{FRANKFURTER}/{start}..{today.isoformat()}",
                params={"from": base, "to": quote},
            )
            r.raise_for_status()
            hist = r.json()

        rates = {d: v[quote] for d, v in hist.get("rates", {}).items() if quote in v}
        if not rates:
            return _err(pair_id, "Nessun dato da Frankfurter")

        sorted_dates = sorted(rates.keys())
        current_rate = rates[sorted_dates[-1]]

        def pct_change(n_days: int) -> float | None:
            target = (today - timedelta(days=n_days)).isoformat()
            past   = next((rates[d] for d in sorted_dates if d >= target), None)
            return round((current_rate - past) / past * 100, 3) if past and past != 0 else None

        p7d  = pct_change(7)
        p30d = pct_change(30)
        p60d = pct_change(60)

        rate_diff  = _rate_diff_score(base, quote)
        mom_score  = _compute_momentum_score(p7d, p30d, p60d)
        # Forex: 50% carry trade (rate diff) + 50% price momentum
        score = round(max(-1.0, min(1.0, rate_diff * 0.50 + mom_score * 0.50)), 3)

        return {
            "agent": "fundamental",
            "symbol": pair_id,
            "score": score,
            "details": {
                "tasso_attuale":    round(current_rate, 5),
                "cambio_7g_pct":    p7d,
                "cambio_30g_pct":   p30d,
                "cambio_60g_pct":   p60d,
                "tasso_base":       _CB_RATES.get(base),
                "tasso_quote":      _CB_RATES.get(quote),
                "diff_tassi_pct":   round(_CB_RATES.get(base, 2) - _CB_RATES.get(quote, 2), 2),
                "base":  base,
                "quote": quote,
                "fonte": "ECB / Frankfurter + differenziale tassi",
            },
            "signal": _sig(score),
            "error": None,
        }
    except Exception as e:
        return _err(pair_id, str(e))


async def _yahoo_momentum(pair_id: str, yahoo_sym: str, base: str, quote: str) -> dict:
    """Price-momentum + rate differential for XAU/USD and similar assets."""
    try:
        sym = yahoo_sym.replace("=", "%3D")
        url = f"{YAHOO_BASE}/{sym}?interval=1d&range=90d"
        async with httpx.AsyncClient(timeout=12, headers=YAHOO_HDR) as client:
            r = await client.get(url)
            r.raise_for_status()
            data = r.json()

        closes = [c for c in data["chart"]["result"][0]["indicators"]["quote"][0]["close"]
                  if c is not None]
        if len(closes) < 10:
            return _err(pair_id, "Dati insufficienti per il calcolo del momentum")

        current = closes[-1]

        def pct(n: int) -> float | None:
            past = closes[-min(n, len(closes))]
            return round((current - past) / past * 100, 3) if past else None

        p7d  = pct(7)
        p30d = pct(30)
        p60d = pct(60)

        rate_diff = _rate_diff_score(base, quote)
        mom_score = _compute_momentum_score(p7d, p30d, p60d)
        # For XAU: rate diff matters (high USD rates hurt gold) — 40% weight
        score = round(max(-1.0, min(1.0, rate_diff * 0.40 + mom_score * 0.60)), 3)

        return {
            "agent": "fundamental",
            "symbol": pair_id,
            "score": score,
            "details": {
                "tasso_attuale":  round(current, 2),
                "cambio_7g_pct":  p7d,
                "cambio_30g_pct": p30d,
                "cambio_60g_pct": p60d,
                "tasso_base":     _CB_RATES.get(base),
                "tasso_quote":    _CB_RATES.get(quote),
                "diff_tassi_pct": round(_CB_RATES.get(base, 0) - _CB_RATES.get(quote, 2), 2),
                "base":  base,
                "quote": quote,
                "fonte": "Yahoo Finance + differenziale tassi",
            },
            "signal": _sig(score),
            "error": None,
        }
    except Exception as e:
        return _err(pair_id, str(e))


# ── Score helpers ─────────────────────────────────────────────────────────────

def _rate_diff_score(base: str, quote: str) -> float:
    """
    Carry trade score: positive = base currency yields more → BUY base.
    EUR/USD with EUR rate 2.5% and USD rate 4.5% → diff=-2.0% → SELL EUR/USD.
    XAU/USD with XAU rate 0% and USD rate 4.5% → diff=-4.5% → SELL XAU/USD
    (high USD rates = high opportunity cost of holding gold).
    """
    rate_base  = _CB_RATES.get(base,  2.0)
    rate_quote = _CB_RATES.get(quote, 2.0)
    diff = rate_base - rate_quote
    return round(max(-1.0, min(1.0, diff / _MAX_RATE_DIFF)), 3)


def _compute_momentum_score(p7d, p30d, p60d) -> float:
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
    return {
        "agent": "fundamental", "symbol": pair_id,
        "score": 0, "details": {}, "signal": "NEUTRAL", "error": msg,
    }
