import math
import pandas as pd
from agents.forex_technical import fetch_ohlcv
from data.forex import get_by_id

ANNUAL_PERIODS = 252    # trading days for forex


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

        returns    = close.pct_change().dropna()
        vol_daily  = float(returns.std())
        vol_annual = vol_daily * math.sqrt(ANNUAL_PERIODS)

        atr_price  = _wilder_atr(high, low, close)
        atr_pips   = round(atr_price * _pip_factor(pair_id))
        atr_daily  = round(atr_price, 5)
        last_close = float(close.iloc[-1])

        max_dd  = _max_drawdown(close)
        sharpe  = _sharpe(returns, ANNUAL_PERIODS)
        sortino = _sortino(returns, ANNUAL_PERIODS)
        var95   = _var_95(returns)
        calmar  = _calmar(returns, max_dd, ANNUAL_PERIODS)
        kelly   = _kelly_size(returns)
        score   = _compute_risk_score(vol_daily, max_dd, sortino)

        # SL/TP calibrati su 0.5/1.0× ATR giornaliero per segnali orari (R:R 1:2)
        # Daily ATR × 1.5/2.5 era troppo ampio per intraday — ridotto di 3×
        pip     = 1 / _pip_factor(pair_id)
        min_sl  = 10 if ("JPY" in pair_id or "XAU" in pair_id) else 15
        min_tp  = 20 if ("JPY" in pair_id or "XAU" in pair_id) else 25
        sl_pips = max(min_sl, round(atr_pips * 0.5))
        tp_pips = max(min_tp, round(atr_pips * 1.0))
        sl_price = round(last_close - sl_pips * pip, 5)
        tp_price = round(last_close + tp_pips * pip, 5)

        return {
            "agent": "risk",
            "symbol": pair_id,
            "score": score,
            "details": {
                "volatilita_giorn_pct":  round(vol_daily * 100, 3),
                "volatilita_annua_pct":  round(vol_annual * 100, 2),
                "max_drawdown_pct":      round(max_dd * 100, 2),
                "sharpe_ratio":          sharpe,
                "sortino_ratio":         sortino,
                "var_95_pct":            var95,
                "calmar_ratio":          calmar,
                "atr_pips":              atr_pips,
                "atr_daily":             atr_daily,
                "suggested_stop_loss":   sl_price,
                "suggested_take_profit": tp_price,
                "position_size_pct":     kelly,
                "risk_level":            _risk_label(vol_daily),
            },
            "signal": _sig(score),
            "error": None,
        }
    except Exception as e:
        return _err(pair_id, str(e))


# ── Risk metrics ─────────────────────────────────────────────────────────────

def _wilder_atr(high: pd.Series, low: pd.Series, close: pd.Series, n: int = 14) -> float:
    """Wilder's Average True Range. More accurate than simple (H-L) mean."""
    prev_c = close.shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_c).abs(),
        (low  - prev_c).abs(),
    ], axis=1).max(axis=1).dropna()
    if len(tr) < 2:
        return float(tr.mean()) if len(tr) > 0 else 0.0
    n = min(n, len(tr))
    atr = float(tr.iloc[:n].mean())
    for tr_i in tr.iloc[n:]:
        atr = (atr * (n - 1) + tr_i) / n
    return atr


def _pip_factor(pair_id: str) -> float:
    if "XAU" in pair_id: return 100    # oro: 1 pip = $0.01
    if "JPY" in pair_id: return 100    # yen: 1 pip = ¥0.01
    return 10000                        # majors: 1 pip = 0.0001


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
    vol_pen = min(1.0, vol * 30) * 0.50
    dd_pen  = min(1.0, abs(dd) * 5) * 0.35
    sor_adj = max(-0.15, min(0.15, sortino * 0.01))
    return round(-vol_pen - dd_pen + sor_adj, 3)


def _risk_label(vol: float) -> str:
    if vol < 0.003: return "LOW"
    if vol < 0.007: return "MEDIUM"
    return "HIGH"


def _sig(score: float) -> str:
    if score > -0.3: return "ACCEPTABLE"
    if score > -0.6: return "CAUTION"
    return "HIGH_RISK"


def _err(pair_id: str, msg: str) -> dict:
    return {"agent": "risk", "symbol": pair_id, "score": 0, "details": {}, "signal": "NEUTRAL", "error": msg}
