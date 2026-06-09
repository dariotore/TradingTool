import math
import pandas as pd
from agents.forex_technical import fetch_ohlcv
from data.commodities import get_by_id

ANNUAL_PERIODS = 252    # trading days for commodities


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
        vol_annual = vol_daily * math.sqrt(ANNUAL_PERIODS)
        atr        = float((high - low).mean())
        last_close = float(close.iloc[-1])

        max_dd  = _max_drawdown(close)
        sharpe  = _sharpe(returns, ANNUAL_PERIODS)
        sortino = _sortino(returns, ANNUAL_PERIODS)
        var95   = _var_95(returns)
        calmar  = _calmar(returns, max_dd, ANNUAL_PERIODS)
        kelly   = _kelly_size(returns)
        score   = _compute_risk_score(vol_daily, max_dd, sortino)

        sl = round(last_close * (1 - vol_daily * 2), 4)
        tp = round(last_close * (1 + vol_daily * 3), 4)

        return {
            "agent": "risk",
            "symbol": commodity_id,
            "score": score,
            "details": {
                "volatilita_giorn_pct":  round(vol_daily * 100, 3),
                "volatilita_annua_pct":  round(vol_annual * 100, 2),
                "max_drawdown_pct":      round(max_dd * 100, 2),
                "sharpe_ratio":          sharpe,
                "sortino_ratio":         sortino,
                "var_95_pct":            var95,
                "calmar_ratio":          calmar,
                "atr":                   round(atr, 4),
                "suggested_stop_loss":   sl,
                "suggested_take_profit": tp,
                "position_size_pct":     kelly,
                "risk_level":            _risk_label(vol_daily),
            },
            "signal": _sig(score),
            "error": None,
        }
    except Exception as e:
        return _err(commodity_id, str(e))


# ── Risk metrics ─────────────────────────────────────────────────────────────

def _sharpe(returns: pd.Series, annual_periods: int = ANNUAL_PERIODS) -> float:
    if len(returns) < 2 or returns.std() == 0:
        return 0.0
    return round(float(returns.mean() / returns.std() * math.sqrt(annual_periods)), 2)


def _sortino(returns: pd.Series, annual_periods: int = ANNUAL_PERIODS) -> float:
    if len(returns) < 2:
        return 0.0
    downside = returns[returns < 0]
    if len(downside) < 2:
        return 0.0
    ds_std = float(downside.std())
    if ds_std == 0:
        return 0.0
    return round(float(returns.mean() / ds_std * math.sqrt(annual_periods)), 2)


def _var_95(returns: pd.Series) -> float:
    if returns.empty:
        return 0.0
    return round(float(returns.quantile(0.05)) * 100, 2)


def _calmar(returns: pd.Series, max_dd: float, annual_periods: int = ANNUAL_PERIODS) -> float:
    if len(returns) < 2 or max_dd == 0:
        return 0.0
    ann_return = float(returns.mean()) * annual_periods
    return round(ann_return / abs(max_dd), 2)


def _kelly_size(returns: pd.Series) -> float:
    if returns.empty:
        return 2.0
    wins   = returns[returns > 0]
    losses = returns[returns < 0]
    if len(wins) == 0 or len(losses) == 0:
        return 2.0
    win_prob  = len(wins) / len(returns)
    avg_win   = float(wins.mean())
    avg_loss  = abs(float(losses.mean()))
    if avg_loss == 0:
        return 5.0
    ratio = avg_win / avg_loss
    kelly = (win_prob * ratio - (1 - win_prob)) / ratio
    return max(1.0, min(10.0, round(kelly * 0.5 * 100, 1)))


def _max_drawdown(prices: pd.Series) -> float:
    peak = prices.expanding().max()
    return float(((prices - peak) / peak).min())


def _compute_risk_score(vol: float, dd: float, sortino: float) -> float:
    vol_pen = min(1.0, vol * 20) * 0.50
    dd_pen  = min(1.0, abs(dd) * 4) * 0.35
    sor_adj = max(-0.15, min(0.15, sortino * 0.01))
    return round(-vol_pen - dd_pen + sor_adj, 3)


def _risk_label(vol: float) -> str:
    if vol < 0.008: return "LOW"
    if vol < 0.018: return "MEDIUM"
    return "HIGH"


def _sig(score: float) -> str:
    if score > -0.3: return "ACCEPTABLE"
    if score > -0.6: return "CAUTION"
    return "HIGH_RISK"


def _err(cid: str, msg: str) -> dict:
    return {"agent": "risk", "symbol": cid, "score": 0, "details": {}, "signal": "NEUTRAL", "error": msg}
