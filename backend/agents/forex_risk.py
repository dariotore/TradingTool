import math
import pandas as pd
from agents.forex_technical import fetch_ohlcv
from data.forex import get_by_id


async def run(pair_id: str) -> dict:
    pair = get_by_id(pair_id)
    if not pair:
        return _err(pair_id, "Coppia non trovata")
    try:
        df = await fetch_ohlcv(pair["yahoo"], interval="1d", yrange="60d")
        if df.empty:
            return _err(pair_id, "Nessun dato")

        close = df["close"].astype(float)
        high  = df["high"].astype(float)
        low   = df["low"].astype(float)

        returns = close.pct_change().dropna()
        vol_daily = float(returns.std())
        vol_annual = vol_daily * math.sqrt(252)

        atr_pips = float((high - low).mean()) * _pip_factor(pair_id)
        last_close = float(close.iloc[-1])

        max_dd = _max_drawdown(close)
        risk_score = _compute_risk_score(vol_daily, max_dd)

        sl_pips = round(atr_pips * 1.5)
        tp_pips = round(atr_pips * 2.5)
        sl_price = round(last_close - sl_pips / _pip_factor(pair_id), 5)
        tp_price = round(last_close + tp_pips / _pip_factor(pair_id), 5)
        pos_size = max(1, min(10, round(0.02 / (vol_daily * 100) * 2, 1))) if vol_daily > 0 else 2

        return {
            "agent": "risk",
            "symbol": pair_id,
            "score": risk_score,
            "details": {
                "volatilita_giorn_pct": round(vol_daily * 100, 3),
                "volatilita_annua_pct": round(vol_annual * 100, 2),
                "max_drawdown_pct": round(max_dd * 100, 2),
                "atr_pips": round(atr_pips),
                "suggested_stop_loss": sl_price,
                "suggested_take_profit": tp_price,
                "position_size_pct": pos_size,
                "risk_level": _risk_label(vol_daily),
            },
            "signal": _sig(risk_score),
            "error": None,
        }
    except Exception as e:
        return _err(pair_id, str(e))


def _pip_factor(pair_id: str) -> float:
    if "JPY" in pair_id: return 100   # JPY pairs: 1 pip = 0.01
    return 10000                       # most pairs: 1 pip = 0.0001


def _max_drawdown(prices: pd.Series) -> float:
    peak = prices.expanding().max()
    dd = (prices - peak) / peak
    return float(dd.min())


def _compute_risk_score(vol: float, dd: float) -> float:
    return round(-(min(1.0, vol * 30) * 0.6 + min(1.0, abs(dd) * 5) * 0.4), 3)


def _risk_label(vol: float) -> str:
    if vol < 0.003: return "LOW"
    if vol < 0.007: return "MEDIUM"
    return "HIGH"


def _sig(score: float) -> str:
    if score > -0.3:  return "ACCEPTABLE"
    if score > -0.6:  return "CAUTION"
    return "HIGH_RISK"


def _err(pair_id: str, msg: str) -> dict:
    return {"agent": "risk", "symbol": pair_id, "score": 0, "details": {}, "signal": "NEUTRAL", "error": msg}
