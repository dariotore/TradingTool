"""
COT (Commitment of Traders) agent for forex signals.
Source: CFTC public reporting API — no API key required.
https://publicreporting.cftc.gov/resource/6dca-aqww.json

Logic:
  Fetch last 20 weeks of non-commercial (speculative) net positioning.
  Compute net % of open interest, then find its 20-week percentile.
  Contrarian interpretation:
    >80th percentile long  → specs overcrowded long  → SELL signal
    <20th percentile long  → specs overcrowded short → BUY signal
    20th–80th              → neutral

Published every Friday for the preceding Tuesday close.
COT is a slow-moving weekly signal — useful for medium-term bias.
"""
import httpx
from data.forex import get_by_id

_CFTC_BASE = "https://publicreporting.cftc.gov/resource/6dca-aqww.json"

# CFTC market name prefix for each currency (matched with LIKE query)
_CCY_TO_MARKET: dict[str, str] = {
    "EUR": "EURO FX",
    "GBP": "BRITISH POUND",
    "JPY": "JAPANESE YEN",
    "CHF": "SWISS FRANC",
    "AUD": "AUSTRALIAN DOLLAR",
    "CAD": "CANADIAN DOLLAR",
    "NZD": "NEW ZEALAND DOLLAR",
}


async def run(pair_id: str) -> dict:
    pair = get_by_id(pair_id)
    if not pair:
        return _err(pair_id, "Coppia non trovata")

    base, quote = pair["base"], pair["quote"]

    # No COT data for gold — the CFTC futures contract is different
    if base == "XAU" or quote == "XAU":
        return _neutral(pair_id, "COT non disponibile per XAU")

    # Analyse the non-USD leg. For USD/JPY we read JPY positioning then invert.
    if base == "USD":
        ccy, invert = quote, True
    else:
        ccy, invert = base, False

    market_name = _CCY_TO_MARKET.get(ccy)
    if not market_name:
        return _neutral(pair_id, f"COT non disponibile per {ccy}")

    try:
        async with httpx.AsyncClient(timeout=15,
                                     headers={"User-Agent": "TradingPlatform/1.0"}) as client:
            r = await client.get(
                _CFTC_BASE,
                params={
                    "$where":  f"market_and_exchange_names like '{market_name}%'",
                    "$order":  "report_date_as_yyyy_mm_dd DESC",
                    "$limit":  20,
                    "$select": (
                        "report_date_as_yyyy_mm_dd,"
                        "noncomm_positions_long_all,"
                        "noncomm_positions_short_all,"
                        "open_interest_all"
                    ),
                },
            )
            r.raise_for_status()
            rows = r.json()

        if not rows:
            return _neutral(pair_id, "Nessun dato COT disponibile")

        # Net speculative position as fraction of open interest per week
        net_pcts: list[float] = []
        for row in rows:
            try:
                longs  = float(row["noncomm_positions_long_all"])
                shorts = float(row["noncomm_positions_short_all"])
                oi     = float(row.get("open_interest_all") or (longs + shorts + 1))
                if oi > 0:
                    net_pcts.append((longs - shorts) / oi)
            except (KeyError, ValueError, ZeroDivisionError):
                continue

        if len(net_pcts) < 5:
            return _neutral(pair_id, "Dati COT insufficienti")

        current_net = net_pcts[0]
        mn, mx      = min(net_pcts), max(net_pcts)
        rang        = mx - mn

        # Percentile within 20-week range (0 = most net short, 1 = most net long)
        pctile = (current_net - mn) / rang if rang > 0 else 0.5

        # Contrarian score
        if   pctile > 0.80: score = -0.70   # overcrowded long  → sell
        elif pctile > 0.65: score = -0.35
        elif pctile < 0.20: score = +0.70   # overcrowded short → buy
        elif pctile < 0.35: score = +0.35
        else:               score =  0.0

        if invert:
            score = -score   # JPY long = USD/JPY short

        score = round(score, 3)
        return {
            "agent":  "cot",
            "symbol": pair_id,
            "score":  score,
            "details": {
                "currency":           ccy,
                "net_pct_corrente":   round(current_net * 100, 2),
                "net_pct_20w_min":    round(mn * 100, 2),
                "net_pct_20w_max":    round(mx * 100, 2),
                "percentile_20w":     round(pctile * 100, 1),
                "settimane_dati":     len(net_pcts),
                "ultimo_report":      rows[0].get("report_date_as_yyyy_mm_dd", ""),
                "invertito":          invert,
            },
            "signal": _sig(score),
            "error":  None,
        }
    except Exception as e:
        return _err(pair_id, str(e))


def _sig(score: float) -> str:
    if score > 0.3:  return "BUY"
    if score < -0.3: return "SELL"
    return "NEUTRAL"


def _neutral(pair_id: str, msg: str) -> dict:
    return {"agent": "cot", "symbol": pair_id, "score": 0.0,
            "details": {"nota": msg}, "signal": "NEUTRAL", "error": None}


def _err(pair_id: str, msg: str) -> dict:
    return {"agent": "cot", "symbol": pair_id, "score": 0,
            "details": {}, "signal": "NEUTRAL", "error": msg}
