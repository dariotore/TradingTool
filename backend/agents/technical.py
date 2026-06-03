import httpx
import pandas as pd

BINANCE_BASE = "https://api.binance.com/api/v3"


async def run(symbol: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{BINANCE_BASE}/klines", params={
                "symbol": symbol,
                "interval": "1h",
                "limit": 100,
            })
            r.raise_for_status()
            raw = r.json()

        df = pd.DataFrame(raw, columns=[
            "open_time","open","high","low","close","volume",
            "close_time","quote_vol","trades","taker_buy_base","taker_buy_quote","ignore"
        ])
        df[["open","high","low","close","volume"]] = df[["open","high","low","close","volume"]].astype(float)

        last_rsi = _rsi(df["close"], 14)
        macd_val, macd_sig = _macd(df["close"])
        bb_upper, bb_lower = _bbands(df["close"], 20)
        last_close = float(df["close"].iloc[-1])

        score = _compute_score(last_rsi, macd_val, macd_sig, last_close, bb_upper, bb_lower)

        return {
            "agent": "technical",
            "symbol": symbol,
            "score": score,
            "details": {
                "rsi": round(last_rsi, 2),
                "macd": round(macd_val, 4),
                "macd_signal": round(macd_sig, 4),
                "macd_bullish": macd_val > macd_sig,
                "bb_upper": round(bb_upper, 2),
                "bb_lower": round(bb_lower, 2),
                "close": round(last_close, 2),
                "bb_position": _bb_position(last_close, bb_upper, bb_lower),
            },
            "signal": _signal(score),
            "error": None,
        }
    except Exception as e:
        return {"agent": "technical", "symbol": symbol, "score": 0, "details": {}, "signal": "NEUTRAL", "error": str(e)}


def _rsi(series: pd.Series, period: int = 14) -> float:
    delta = series.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss.replace(0, float("nan"))
    rsi = 100 - (100 / (1 + rs))
    return float(rsi.iloc[-1]) if not rsi.empty else 50.0


def _macd(series: pd.Series, fast=12, slow=26, signal=9) -> tuple[float, float]:
    ema_fast = series.ewm(span=fast, adjust=False).mean()
    ema_slow = series.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    return float(macd_line.iloc[-1]), float(signal_line.iloc[-1])


def _bbands(series: pd.Series, period: int = 20) -> tuple[float, float]:
    ma = series.rolling(period).mean()
    std = series.rolling(period).std()
    upper = ma + 2 * std
    lower = ma - 2 * std
    return float(upper.iloc[-1]), float(lower.iloc[-1])


def _compute_score(rsi, macd, macd_sig, close, bb_upper, bb_lower) -> float:
    score = 0.0
    if rsi < 30:
        score += 1.0
    elif rsi < 45:
        score += 0.5
    elif rsi > 70:
        score -= 1.0
    elif rsi > 55:
        score -= 0.5
    score += 0.5 if macd > macd_sig else -0.5
    bb_range = bb_upper - bb_lower
    if bb_range > 0:
        pos = (close - bb_lower) / bb_range
        if pos < 0.2:
            score += 0.5
        elif pos > 0.8:
            score -= 0.5
    return round(score / 2, 3)


def _bb_position(close, upper, lower) -> str:
    if upper == lower:
        return "middle"
    pos = (close - lower) / (upper - lower)
    if pos > 0.8:
        return "near_upper"
    if pos < 0.2:
        return "near_lower"
    return "middle"


def _signal(score: float) -> str:
    if score > 0.3:
        return "BUY"
    if score < -0.3:
        return "SELL"
    return "NEUTRAL"
