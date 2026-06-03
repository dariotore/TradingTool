import httpx
import pandas as pd
import math

BINANCE_BASE = "https://api.binance.com/api/v3"

async def run(symbol: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{BINANCE_BASE}/klines", params={
                "symbol": symbol,
                "interval": "1d",
                "limit": 30,
            })
            r.raise_for_status()
            raw = r.json()

        df = pd.DataFrame(raw, columns=[
            "open_time","open","high","low","close","volume",
            "close_time","quote_vol","trades","taker_buy_base","taker_buy_quote","ignore"
        ])
        df["close"] = df["close"].astype(float)
        df["high"] = df["high"].astype(float)
        df["low"] = df["low"].astype(float)

        returns = df["close"].pct_change().dropna()
        volatility_daily = float(returns.std())
        volatility_annual = volatility_daily * math.sqrt(365)

        atr = float((df["high"] - df["low"]).mean())
        last_close = float(df["close"].iloc[-1])

        max_drawdown = _max_drawdown(df["close"])
        risk_score = _compute_risk_score(volatility_daily, max_drawdown)

        suggested_stop_loss = round(last_close * (1 - volatility_daily * 2), 2)
        suggested_take_profit = round(last_close * (1 + volatility_daily * 3), 2)
        position_size_pct = max(1, min(10, round(1 / (volatility_daily * 100) * 2, 1)))

        return {
            "agent": "risk",
            "symbol": symbol,
            "score": risk_score,
            "details": {
                "volatility_daily_pct": round(volatility_daily * 100, 2),
                "volatility_annual_pct": round(volatility_annual * 100, 2),
                "max_drawdown_pct": round(max_drawdown * 100, 2),
                "atr": round(atr, 2),
                "suggested_stop_loss": suggested_stop_loss,
                "suggested_take_profit": suggested_take_profit,
                "position_size_pct": position_size_pct,
                "risk_level": _risk_label(volatility_daily),
            },
            "signal": _signal(risk_score),
            "error": None,
        }
    except Exception as e:
        return {"agent": "risk", "symbol": symbol, "score": 0, "details": {}, "signal": "NEUTRAL", "error": str(e)}


def _max_drawdown(prices: pd.Series) -> float:
    peak = prices.expanding().max()
    drawdown = (prices - peak) / peak
    return float(drawdown.min())


def _compute_risk_score(volatility: float, drawdown: float) -> float:
    vol_penalty = min(1.0, volatility * 20)
    dd_penalty = min(1.0, abs(drawdown) * 3)
    raw = -(vol_penalty * 0.6 + dd_penalty * 0.4)
    return round(raw, 3)


def _risk_label(volatility: float) -> str:
    if volatility < 0.02:
        return "LOW"
    if volatility < 0.04:
        return "MEDIUM"
    return "HIGH"


def _signal(score: float) -> str:
    if score > -0.3:
        return "ACCEPTABLE"
    if score > -0.6:
        return "CAUTION"
    return "HIGH_RISK"
