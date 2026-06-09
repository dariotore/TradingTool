import pandas as pd
import math
from data import coins as coin_registry
from utils import price_history, yahoo_history

MIN_POINTS = 10
ANNUAL_PERIODS = 365 * 24   # hourly crypto


def _symbol_to_id(symbol: str) -> str:
    coin = next((c for c in coin_registry._registry if c.get("binance_symbol") == symbol), None)
    if not coin:
        raise ValueError(f"Symbol {symbol} not found in registry")
    return coin["id"]


async def run(symbol: str) -> dict:
    try:
        coin_id = _symbol_to_id(symbol)

        close = price_history.get_series(coin_id)
        if close is None or len(close) < MIN_POINTS:
            close = await yahoo_history.get_close_series(symbol)

        returns    = close.pct_change().dropna()
        volatility = float(returns.std())
        vol_annual = volatility * math.sqrt(ANNUAL_PERIODS)
        last_close = float(close.iloc[-1])
        max_dd     = _max_drawdown(close)
        sharpe     = _sharpe(returns, ANNUAL_PERIODS)
        sortino    = _sortino(returns, ANNUAL_PERIODS)
        var95      = _var_95(returns)
        calmar     = _calmar(returns, max_dd, ANNUAL_PERIODS)
        kelly_pct  = _kelly_size(returns)
        score      = _compute_risk_score(volatility, max_dd, sortino)

        # ATR-based SL/TP: convert hourly volatility to daily equivalent
        atr_daily = volatility * math.sqrt(24)

        return {
            "agent": "risk",
            "symbol": symbol,
            "score": score,
            "details": {
                "volatility_daily_pct":  round(volatility * 100, 2),
                "volatility_annual_pct": round(vol_annual * 100, 2),
                "atr_daily_pct":         round(atr_daily * 100, 2),
                "max_drawdown_pct":      round(max_dd * 100, 2),
                "sharpe_ratio":          sharpe,
                "sortino_ratio":         sortino,
                "var_95_pct":            var95,
                "calmar_ratio":          calmar,
                "suggested_stop_loss":   round(last_close * (1 - atr_daily * 1.5), 2),
                "suggested_take_profit": round(last_close * (1 + atr_daily * 2.5), 2),
                "position_size_pct":     kelly_pct,
                "risk_level":            _risk_label(volatility),
            },
            "signal": _signal(score),
            "error": None,
        }
    except Exception as e:
        return {"agent": "risk", "symbol": symbol, "score": 0, "details": {}, "signal": "NEUTRAL", "error": str(e)}


# ── Risk metrics ────────────────────────────────────────────────────────────

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
    """5th-percentile loss as a positive percentage."""
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
    loss_prob = 1.0 - win_prob
    avg_win   = float(wins.mean())
    avg_loss  = abs(float(losses.mean()))
    if avg_loss == 0:
        return 5.0
    ratio = avg_win / avg_loss
    kelly = (win_prob * ratio - loss_prob) / ratio
    # Use half-Kelly as position size in pct (conservative), cap at 10%
    size = max(1.0, min(10.0, round(kelly * 0.5 * 100, 1)))
    return size


def _max_drawdown(prices: pd.Series) -> float:
    peak = prices.expanding().max()
    return float(((prices - peak) / peak).min())


def _compute_risk_score(volatility: float, drawdown: float, sortino: float) -> float:
    vol_pen  = min(1.0, volatility * 20) * 0.50
    dd_pen   = min(1.0, abs(drawdown) * 3) * 0.35
    sor_adj  = max(-0.15, min(0.15, sortino * 0.01))
    return round(-vol_pen - dd_pen + sor_adj, 3)


def _risk_label(volatility: float) -> str:
    if volatility < 0.005: return "LOW"
    if volatility < 0.015: return "MEDIUM"
    return "HIGH"


def _signal(score: float) -> str:
    if score > -0.3: return "ACCEPTABLE"
    if score > -0.6: return "CAUTION"
    return "HIGH_RISK"
