"""
Professional technical analysis agent for forex pairs.
Exports all indicator helpers so technical.py and commodity_technical.py can reuse them.
"""
import asyncio
import httpx
import pandas as pd
from data.forex import get_by_id

YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}


async def fetch_ohlcv(yahoo_sym: str, interval: str = "60m", yrange: str = "5d") -> pd.DataFrame:
    url       = f"{YAHOO_BASE}/{yahoo_sym.replace('=', '%3D')}?interval={interval}&range={yrange}"
    last_exc: Exception | None = None
    for wait in [None, 0.5, 1.5]:
        if wait:
            await asyncio.sleep(wait)
        try:
            async with httpx.AsyncClient(timeout=15, headers=HEADERS) as client:
                r = await client.get(url)
                r.raise_for_status()
                result = r.json()
            data = result["chart"]["result"][0]
            q    = data["indicators"]["quote"][0]
            rows = [
                {"ts": int(ts * 1000), "open": o or c, "high": h or c, "low": l or c, "close": c}
                for ts, o, h, l, c in zip(
                    data["timestamp"],
                    q.get("open", []), q.get("high", []), q.get("low", []), q.get("close", []),
                )
                if c is not None and h is not None and l is not None
            ]
            return pd.DataFrame(rows)
        except Exception as exc:
            last_exc = exc
    raise last_exc  # type: ignore[misc]


async def run(pair_id: str) -> dict:
    pair = get_by_id(pair_id)
    if not pair:
        return _err(pair_id, "Coppia non trovata nel registry")
    try:
        # Fetch hourly (10d) and daily (90d) in parallel
        df, df_daily = await asyncio.gather(
            fetch_ohlcv(pair["yahoo"], interval="60m", yrange="10d"),
            fetch_ohlcv(pair["yahoo"], interval="1d",  yrange="90d"),
        )
        if df.empty:
            return _err(pair_id, "Nessun dato da Yahoo Finance")

        close  = df["close"].astype(float)
        high   = df["high"].astype(float)
        low    = df["low"].astype(float)
        open_s = df["open"].astype(float)
        last   = float(close.iloc[-1])

        rsi_s               = _rsi_series(close)
        last_rsi            = _safe_last(rsi_s, 50.0)
        macd_v, macd_sig    = _macd(close)
        bb_u,   bb_l        = _bbands(close)
        ema50               = _ema(close, 50)
        adx, di_pos, di_neg = _adx(high, low, close)
        stoch_k, stoch_d    = _stochastic(high, low, close)
        structure           = _market_structure(close)
        divergence          = _rsi_divergence(close, rsi_s)
        sr                  = _support_resistance(high, low, close)
        candle              = _candlestick_patterns(open_s, high, low, close)

        # Daily MTF filter
        mtf = _empty_mtf()
        if df_daily is not None and not df_daily.empty and len(df_daily) >= 30:
            mtf = _mtf_filter(
                df_daily["close"].astype(float),
                df_daily["high"].astype(float),
                df_daily["low"].astype(float),
            )

        score = _professional_score(
            last_rsi, macd_v, macd_sig, last, bb_u, bb_l,
            ema50, None, adx, di_pos, di_neg,
            stoch_k, stoch_d, structure, divergence, False,
            mtf_trend=mtf["trend"],
            candle_signal=candle["signal"],
        )

        change_24h = None
        if len(close) >= 24:
            p24 = float(close.iloc[-24])
            if p24 != 0:
                change_24h = round((last - p24) / p24 * 100, 3)

        trend_label = "forte" if adx > 25 else ("debole" if adx < 20 else "moderato")

        return {
            "agent": "technical",
            "symbol": pair_id,
            "score": score,
            "details": {
                "rsi":              round(last_rsi, 1),
                "macd_bullish":     macd_v > macd_sig,
                "bb_position":      _bb_pos(last, bb_u, bb_l),
                "ema50":            round(ema50, 5),
                "above_ema50":      last > ema50,
                "adx":              round(adx, 1),
                "trend_strength":   trend_label,
                "di_plus_above":    di_pos > di_neg,
                "stoch_k":          round(stoch_k, 1),
                "stoch_overbought": stoch_k > 80,
                "stoch_oversold":   stoch_k < 20,
                "market_structure": structure,
                "divergence":       divergence,
                "close":            round(last, 5),
                "price_change_24h_pct": change_24h,
                # Multi-timeframe
                "mtf_trend":        mtf["trend"],
                "adx_daily":        mtf.get("adx_daily"),
                "structure_daily":  mtf.get("structure_daily"),
                # Support / Resistance
                "nearest_support":    sr.get("nearest_support"),
                "nearest_resistance": sr.get("nearest_resistance"),
                "pivot": sr.get("pivot"),
                "r1": sr.get("r1"), "r2": sr.get("r2"),
                "s1": sr.get("s1"), "s2": sr.get("s2"),
                # Candlestick patterns
                "candle_patterns": candle["patterns"],
                "candle_signal":   candle["signal"],
            },
            "signal": _sig(score),
            "error": None,
        }
    except Exception as e:
        return _err(pair_id, str(e))


# ── Basic indicator helpers ──────────────────────────────────────────────────

def _safe_last(s: pd.Series, default: float) -> float:
    if s.empty: return default
    v = s.iloc[-1]
    return float(v) if not pd.isna(v) else default


def _rsi_series(s: pd.Series, period: int = 14) -> pd.Series:
    d    = s.diff()
    gain = d.clip(lower=0).rolling(period).mean()
    loss = (-d.clip(upper=0)).rolling(period).mean()
    rs   = gain / loss.replace(0, float("nan"))
    return 100 - (100 / (1 + rs))


def _rsi(s: pd.Series, n: int = 14) -> float:
    return _safe_last(_rsi_series(s, n), 50.0)


def _ema(s: pd.Series, period: int = 50) -> float:
    return float(s.ewm(span=period, adjust=False).mean().iloc[-1])


def _macd(s: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> tuple[float, float]:
    ema_f = s.ewm(span=fast,   adjust=False).mean()
    ema_s = s.ewm(span=slow,   adjust=False).mean()
    line  = ema_f - ema_s
    sig   = line.ewm(span=signal, adjust=False).mean()
    return float(line.iloc[-1]), float(sig.iloc[-1])


def _bbands(s: pd.Series, n: int = 20) -> tuple[float, float]:
    ma  = s.rolling(n).mean()
    std = s.rolling(n).std()
    return float((ma + 2 * std).iloc[-1]), float((ma - 2 * std).iloc[-1])


def _adx(high: pd.Series, low: pd.Series, close: pd.Series,
         period: int = 14) -> tuple[float, float, float]:
    prev = close.shift(1)
    tr   = pd.concat([(high - low), (high - prev).abs(), (low - prev).abs()], axis=1).max(axis=1)
    h_d  = high.diff()
    l_d  = -low.diff()
    dm_p = h_d.where((h_d > l_d) & (h_d > 0), 0.0)
    dm_n = l_d.where((l_d > h_d) & (l_d > 0), 0.0)
    atr  = tr.ewm(alpha=1 / period, adjust=False).mean()
    safe = atr.replace(0, float("nan"))
    di_p = 100 * dm_p.ewm(alpha=1 / period, adjust=False).mean() / safe
    di_n = 100 * dm_n.ewm(alpha=1 / period, adjust=False).mean() / safe
    dx   = 100 * (di_p - di_n).abs() / (di_p + di_n).replace(0, float("nan"))
    adx  = dx.ewm(alpha=1 / period, adjust=False).mean()
    return _safe_last(adx, 20.0), _safe_last(di_p, 20.0), _safe_last(di_n, 20.0)


def _stochastic(high: pd.Series, low: pd.Series, close: pd.Series,
                k: int = 14, d: int = 3) -> tuple[float, float]:
    lo    = low.rolling(k).min()
    hi    = high.rolling(k).max()
    pct_k = 100 * (close - lo) / (hi - lo).replace(0, float("nan"))
    pct_d = pct_k.rolling(d).mean()
    return _safe_last(pct_k, 50.0), _safe_last(pct_d, 50.0)


def _market_structure(close: pd.Series, periods: int = 20) -> str:
    if len(close) < periods * 2:
        return "unknown"
    h1 = close.iloc[-(periods * 2):-periods]
    h2 = close.iloc[-periods:]
    if float(h2.max()) > float(h1.max()) and float(h2.min()) > float(h1.min()):
        return "uptrend"
    if float(h2.max()) < float(h1.max()) and float(h2.min()) < float(h1.min()):
        return "downtrend"
    return "ranging"


def _rsi_divergence(close: pd.Series, rsi: pd.Series, lookback: int = 14) -> str:
    if len(close) < lookback + 1 or rsi.isna().all():
        return "none"
    c = close.iloc[-lookback:]
    r = rsi.iloc[-lookback:].dropna()
    if len(r) < 4:
        return "none"
    if float(c.iloc[-1]) < float(c.iloc[0]) and float(r.iloc[-1]) > float(r.iloc[0]):
        return "bullish"
    if float(c.iloc[-1]) > float(c.iloc[0]) and float(r.iloc[-1]) < float(r.iloc[0]):
        return "bearish"
    return "none"


def _bb_pos(close: float, upper: float, lower: float) -> str:
    if upper == lower: return "middle"
    pos = (close - lower) / (upper - lower)
    if pos > 0.8: return "near_upper"
    if pos < 0.2: return "near_lower"
    return "middle"


# ── New: Multi-timeframe filter ──────────────────────────────────────────────

def _empty_mtf() -> dict:
    return {"trend": "neutral", "adx_daily": None, "ema50_bullish": None, "structure_daily": "unknown"}


def _mtf_filter(close_d: pd.Series, high_d: pd.Series, low_d: pd.Series) -> dict:
    """Daily-timeframe trend direction. Trend confirmed when ADX>20 and DI+/DI- agree with EMA."""
    if len(close_d) < 30:
        return _empty_mtf()
    adx_d, di_p_d, di_n_d = _adx(high_d, low_d, close_d)
    ema50_d  = _ema(close_d, 50)
    last_d   = float(close_d.iloc[-1])
    struct_d = _market_structure(close_d, periods=10)

    bullish = di_p_d > di_n_d and last_d > ema50_d
    bearish = di_n_d > di_p_d and last_d < ema50_d

    if adx_d > 20 and bullish:
        trend = "up"
    elif adx_d > 20 and bearish:
        trend = "down"
    else:
        trend = "neutral"

    return {
        "trend":           trend,
        "adx_daily":       round(adx_d, 1),
        "ema50_bullish":   last_d > ema50_d,
        "structure_daily": struct_d,
    }


# ── New: Support / Resistance ────────────────────────────────────────────────

def _support_resistance(high: pd.Series, low: pd.Series, close: pd.Series,
                        lookback: int = 60, window: int = 5) -> dict:
    """
    Detects swing-based S/R levels plus classic pivot points.
    Returns nearest support (below price) and resistance (above price).
    """
    n = min(lookback, len(close))
    h = high.iloc[-n:].reset_index(drop=True)
    l = low.iloc[-n:].reset_index(drop=True)
    last = float(close.iloc[-1])

    swing_highs: list[float] = []
    swing_lows:  list[float] = []
    for i in range(window, len(h) - window):
        val_h = float(h.iloc[i])
        val_l = float(l.iloc[i])
        if val_h >= float(h.iloc[i - window:i + window + 1].max()):
            swing_highs.append(val_h)
        if val_l <= float(l.iloc[i - window:i + window + 1].min()):
            swing_lows.append(val_l)

    def _cluster(levels: list[float], pct: float = 0.003) -> list[float]:
        result: list[float] = []
        for lv in sorted(levels):
            if not result or abs(lv - result[-1]) / max(result[-1], 1e-10) > pct:
                result.append(lv)
            else:
                result[-1] = (result[-1] + lv) / 2
        return result

    resistances = _cluster([r for r in swing_highs if r > last * 1.001])
    supports    = _cluster([s for s in swing_lows  if s < last * 0.999])
    supports.sort(reverse=True)

    # Classic pivot points from the last completed bar
    ph  = float(high.iloc[-1])
    pl  = float(low.iloc[-1])
    pc  = last
    pp  = (ph + pl + pc) / 3
    r1  = round(2 * pp - pl, 6)
    r2  = round(pp + (ph - pl), 6)
    s1  = round(2 * pp - ph, 6)
    s2  = round(pp - (ph - pl), 6)

    return {
        "nearest_support":    round(supports[0],    6) if supports    else s1,
        "nearest_resistance": round(resistances[0], 6) if resistances else r1,
        "pivot": round(pp, 6),
        "r1": r1, "r2": r2,
        "s1": s1, "s2": s2,
    }


# ── New: Candlestick pattern recognition ────────────────────────────────────

def _candlestick_patterns(open_: pd.Series, high: pd.Series,
                          low: pd.Series, close: pd.Series) -> dict:
    """
    Detect single- and multi-candle reversal patterns in the last 3 bars.
    Returns list of pattern names + combined directional signal.
    """
    if len(close) < 3:
        return {"patterns": [], "signal": "neutral"}

    o1, h1, l1, c1 = float(open_.iloc[-1]), float(high.iloc[-1]), float(low.iloc[-1]), float(close.iloc[-1])
    o2, h2, l2, c2 = float(open_.iloc[-2]), float(high.iloc[-2]), float(low.iloc[-2]), float(close.iloc[-2])
    o3, h3, l3, c3 = float(open_.iloc[-3]), float(high.iloc[-3]), float(low.iloc[-3]), float(close.iloc[-3])

    body1   = abs(c1 - o1)
    range1  = h1 - l1
    body2   = abs(c2 - o2)
    body3   = abs(c3 - o3)

    upper1 = h1 - max(o1, c1)
    lower1 = min(o1, c1) - l1

    patterns: list[str] = []
    bullish_count = 0
    bearish_count = 0

    # --- Single-bar ---
    # Doji
    if range1 > 0 and body1 / range1 < 0.10:
        patterns.append("doji")

    # Hammer (bullish): lower shadow > 2× body, tiny upper shadow, occurs after move
    if range1 > 0 and body1 > 0 and lower1 > body1 * 2 and upper1 < body1 * 0.5:
        patterns.append("hammer")
        bullish_count += 1

    # Shooting Star (bearish): upper shadow > 2× body, tiny lower shadow
    if range1 > 0 and body1 > 0 and upper1 > body1 * 2 and lower1 < body1 * 0.5:
        patterns.append("shooting_star")
        bearish_count += 1

    # --- Two-bar ---
    # Bullish Engulfing: prev red, current green fully engulfs prev body
    if c2 < o2 and c1 > o1 and o1 <= c2 and c1 >= o2:
        patterns.append("bullish_engulfing")
        bullish_count += 2

    # Bearish Engulfing: prev green, current red fully engulfs prev body
    if c2 > o2 and c1 < o1 and o1 >= c2 and c1 <= o2:
        patterns.append("bearish_engulfing")
        bearish_count += 2

    # --- Three-bar ---
    # Morning Star (bullish): big red, small-body gap, big green closes above midpoint
    midpoint3 = (o3 + c3) / 2
    if (c3 < o3 and body3 > 0 and body2 < body3 * 0.35
            and c1 > o1 and c1 > midpoint3):
        patterns.append("morning_star")
        bullish_count += 2

    # Evening Star (bearish): big green, small-body, big red closes below midpoint
    if (c3 > o3 and body3 > 0 and body2 < body3 * 0.35
            and c1 < o1 and c1 < midpoint3):
        patterns.append("evening_star")
        bearish_count += 2

    if   bullish_count > bearish_count: signal = "bullish"
    elif bearish_count > bullish_count: signal = "bearish"
    else:                               signal = "neutral"

    return {"patterns": patterns, "signal": signal}


# ── Professional scoring model ───────────────────────────────────────────────

def _professional_score(
    rsi: float, macd: float, macd_sig: float,
    close: float, bb_u: float, bb_l: float,
    ema50: float, ema200: float | None,
    adx: float, di_pos: float, di_neg: float,
    stoch_k: float, stoch_d: float,
    structure: str, divergence: str, vol_surge: bool,
    mtf_trend: str = "neutral",
    candle_signal: str = "neutral",
) -> float:
    is_trending = adx > 25
    is_ranging  = adx < 20
    score       = 0.0

    # 1. TREND DIRECTION (ADX × DI sign)
    trend_mag = min(1.0, adx / 40)
    score += (0.25 if di_pos > di_neg else -0.25) * trend_mag

    # 2. MOMENTUM: RSI (60%) + Stochastic (40%)
    if   rsi < 25:  rsi_s = 1.0
    elif rsi < 35:  rsi_s = 0.6
    elif rsi < 45:  rsi_s = 0.2
    elif rsi > 75:  rsi_s = -1.0
    elif rsi > 65:  rsi_s = -0.6
    elif rsi > 55:  rsi_s = -0.2
    else:           rsi_s = 0.0

    if   stoch_k < 20 and stoch_k > stoch_d:  st_s = 0.8
    elif stoch_k < 20:                          st_s = 0.4
    elif stoch_k > 80 and stoch_k < stoch_d:   st_s = -0.8
    elif stoch_k > 80:                          st_s = -0.4
    elif stoch_k > stoch_d:                     st_s = 0.15
    else:                                       st_s = -0.15

    mom_w = 0.30 if is_ranging else 0.22
    score += mom_w * (rsi_s * 0.6 + st_s * 0.4)

    # 3. MACD (weight higher when trending)
    if   macd > 0 and macd > macd_sig:   mc_s = 1.0
    elif macd > 0:                        mc_s = 0.4
    elif macd < 0 and macd < macd_sig:    mc_s = -1.0
    elif macd < 0:                        mc_s = -0.4
    elif macd > macd_sig:                 mc_s = 0.2
    else:                                 mc_s = -0.2
    score += (0.20 if is_trending else 0.15) * mc_s

    # 4. BOLLINGER BANDS (weight higher when ranging)
    bb_range = bb_u - bb_l
    if bb_range > 0:
        pos = (close - bb_l) / bb_range
        if   pos < 0.10:  bb_s = 1.0
        elif pos < 0.25:  bb_s = 0.4
        elif pos > 0.90:  bb_s = -1.0
        elif pos > 0.75:  bb_s = -0.4
        else:             bb_s = 0.0
        score += (0.18 if is_ranging else 0.10) * bb_s

    # 5. EMA FILTER
    score += 0.12 if close > ema50 else -0.12
    if ema200 is not None:
        score += 0.04 if ema50 > ema200 else -0.04

    # 6. MARKET STRUCTURE
    if structure == "uptrend":    score += 0.10
    elif structure == "downtrend": score -= 0.10

    # 7. RSI DIVERGENCE
    if   divergence == "bullish": score += 0.12
    elif divergence == "bearish": score -= 0.12

    # 8. VOLUME SURGE
    if vol_surge:
        score += 0.06 if score > 0 else -0.06

    # 9. MULTI-TIMEFRAME ALIGNMENT (daily trend)
    if   mtf_trend == "up":   score += 0.12
    elif mtf_trend == "down": score -= 0.12

    # 10. CANDLESTICK PATTERN
    if   candle_signal == "bullish": score += 0.07
    elif candle_signal == "bearish": score -= 0.07

    return round(max(-1.0, min(1.0, score)), 3)


# ── Legacy compatibility ─────────────────────────────────────────────────────

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


def _sig(score: float) -> str:
    if score > 0.3:  return "BUY"
    if score < -0.3: return "SELL"
    return "NEUTRAL"


def _err(pair_id: str, msg: str) -> dict:
    return {"agent": "technical", "symbol": pair_id, "score": 0,
            "details": {}, "signal": "NEUTRAL", "error": msg}
