import math
import pandas as pd
from agents.forex_technical import fetch_ohlcv
from data.commodities import get_by_id


async def run(commodity_id: str) -> dict:
    comm = get_by_id(commodity_id)
    if not comm:
        return _err(commodity_id, "Commodity non trovata")
    try:
        df = await fetch_ohlcv(comm["id"], interval="1d", yrange="60d")
        if df.empty:
            return _err(commodity_id, "Nessun dato")

        close = df["close"].astype(float)
        high  = df["high"].astype(float)
        low   = df["low"].astype(float)

        returns    = close.pct_change().dropna()
        vol_daily  = float(returns.std())
        vol_annual = vol_daily * math.sqrt(252)
        atr        = float((high - low).mean())
        last_close = float(close.iloc[-1])
        max_dd     = _max_drawdown(close)
        risk_score = _compute_risk_score(vol_daily, max_dd)

        sl = round(last_close * (1 - vol_daily * 2), 4)
        tp = round(last_close * (1 + vol_daily * 3), 4)
        pos_size = max(1, min(10, round(0.02 / (vol_daily * 100) * 2, 1))) if vol_daily > 0 else 2

        return {
            "agent": "risk",
            "symbol": commodity_id,
            "score": risk_score,
            "details": {
                "volatilita_giorn_pct": round(vol_daily * 100, 3),
                "volatilita_annua_pct": round(vol_annual * 100, 2),
                "max_drawdown_pct":     round(max_dd * 100, 2),
                "atr":                  round(atr, 4),
                "suggested_stop_loss":  sl,
                "suggested_take_profit": tp,
                "position_size_pct":    pos_size,
                "risk_level":           _risk_label(vol_daily),
            },
            "signal": _sig(risk_score),
            "error": None,
        }
    except Exception as e:
        return _err(commodity_id, str(e))


def _max_drawdown(prices: pd.Series) -> float:
    peak = prices.expanding().max()
    return float(((prices - peak) / peak).min())


def _compute_risk_score(vol: float, dd: float) -> float:
    return round(-(min(1.0, vol * 20) * 0.6 + min(1.0, abs(dd) * 4) * 0.4), 3)


def _risk_label(vol: float) -> str:
    if vol < 0.008: return "LOW"
    if vol < 0.018: return "MEDIUM"
    return "HIGH"


def _sig(score: float) -> str:
    if score > -0.3:  return "ACCEPTABLE"
    if score > -0.6:  return "CAUTION"
    return "HIGH_RISK"


def _err(cid: str, msg: str) -> dict:
    return {"agent": "risk", "symbol": cid, "score": 0, "details": {}, "signal": "NEUTRAL", "error": msg}
