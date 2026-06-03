import httpx
import pandas as pd
from data.forex import get_by_id

YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}


async def fetch_ohlcv(yahoo_sym: str, interval: str = "60m", yrange: str = "5d") -> pd.DataFrame:
    url = f"{YAHOO_BASE}/{yahoo_sym.replace('=', '%3D')}?interval={interval}&range={yrange}"
    async with httpx.AsyncClient(timeout=12, headers=HEADERS) as client:
        r = await client.get(url)
        r.raise_for_status()
        result = r.json()

    data = result["chart"]["result"][0]
    timestamps = data["timestamp"]
    q = data["indicators"]["quote"][0]

    rows = [
        {"ts": int(ts * 1000), "open": o, "high": h, "low": l, "close": c}
        for ts, o, h, l, c in zip(timestamps, q["open"], q["high"], q["low"], q["close"])
        if c is not None and h is not None and l is not None
    ]
    return pd.DataFrame(rows)


async def run(pair_id: str) -> dict:
    pair = get_by_id(pair_id)
    if not pair:
        return _err(pair_id, "Coppia non trovata nel registry")
    try:
        df = await fetch_ohlcv(pair["yahoo"], interval="60m", yrange="5d")
        if df.empty:
            return _err(pair_id, "Nessun dato da Yahoo Finance")

        close = df["close"]
        rsi = _rsi(close)
        macd_val, macd_sig = _macd(close)
        bb_upper, bb_lower = _bbands(close)
        last_close = float(close.iloc[-1])
        score = _compute_score(rsi, macd_val, macd_sig, last_close, bb_upper, bb_lower)

        change_24h = None
        if len(close) >= 24:
            p24 = float(close.iloc[-24])
            if p24 != 0:
                change_24h = round((last_close - p24) / p24 * 100, 3)

        return {
            "agent": "technical",
            "symbol": pair_id,
            "score": score,
            "details": {
                "rsi": round(rsi, 2),
                "macd": round(macd_val, 5),
                "macd_signal": round(macd_sig, 5),
                "macd_bullish": macd_val > macd_sig,
                "bb_upper": round(bb_upper, 5),
                "bb_lower": round(bb_lower, 5),
                "close": round(last_close, 5),
                "bb_position": _bb_pos(last_close, bb_upper, bb_lower),
                "price_change_24h_pct": change_24h,
            },
            "signal": _sig(score),
            "error": None,
        }
    except Exception as e:
        return _err(pair_id, str(e))


def _rsi(s: pd.Series, n: int = 14) -> float:
    d = s.diff()
    gain = d.clip(lower=0).rolling(n).mean()
    loss = (-d.clip(upper=0)).rolling(n).mean()
    rs = gain / loss.replace(0, float("nan"))
    rsi = 100 - (100 / (1 + rs))
    return float(rsi.iloc[-1]) if not rsi.empty else 50.0


def _macd(s: pd.Series) -> tuple[float, float]:
    ema_f = s.ewm(span=12, adjust=False).mean()
    ema_s = s.ewm(span=26, adjust=False).mean()
    line = ema_f - ema_s
    sig = line.ewm(span=9, adjust=False).mean()
    return float(line.iloc[-1]), float(sig.iloc[-1])


def _bbands(s: pd.Series, n: int = 20) -> tuple[float, float]:
    ma = s.rolling(n).mean()
    std = s.rolling(n).std()
    return float((ma + 2 * std).iloc[-1]), float((ma - 2 * std).iloc[-1])


def _compute_score(rsi, macd, sig, close, upper, lower) -> float:
    score = 0.0
    if rsi < 30:   score += 1.0
    elif rsi < 45: score += 0.5
    elif rsi > 70: score -= 1.0
    elif rsi > 55: score -= 0.5
    score += 0.5 if macd > sig else -0.5
    r = upper - lower
    if r > 0:
        pos = (close - lower) / r
        if pos < 0.2:   score += 0.5
        elif pos > 0.8: score -= 0.5
    return round(score / 2, 3)


def _bb_pos(close, upper, lower) -> str:
    if upper == lower: return "middle"
    pos = (close - lower) / (upper - lower)
    if pos > 0.8: return "near_upper"
    if pos < 0.2: return "near_lower"
    return "middle"


def _sig(score: float) -> str:
    if score > 0.3:  return "BUY"
    if score < -0.3: return "SELL"
    return "NEUTRAL"


def _err(pair_id: str, msg: str) -> dict:
    return {"agent": "technical", "symbol": pair_id, "score": 0, "details": {}, "signal": "NEUTRAL", "error": msg}
