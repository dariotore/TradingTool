"""
Professional technical analysis agent for crypto assets.
All indicator math lives in forex_technical and is imported here
so there is a single source of truth for every calculation.
"""
import asyncio
import pandas as pd
from data import coins as coin_registry
from utils import price_history, yahoo_history
from agents.forex_technical import (
    _safe_last, _rsi_series, _macd, _bbands, _ema, _adx, _stochastic,
    _market_structure, _rsi_divergence, _bb_pos, _professional_score,
    _mtf_filter, _support_resistance, _candlestick_patterns, _empty_mtf,
)

MIN_POINTS = 26


def _symbol_to_id(symbol: str) -> str:
    coin = next((c for c in coin_registry._registry if c.get("binance_symbol") == symbol), None)
    if not coin:
        raise ValueError(f"Symbol {symbol} not found in registry")
    return coin["id"]


async def run(symbol: str) -> dict:
    try:
        coin_id = _symbol_to_id(symbol)

        # Fetch OHLCV hourly + daily in parallel
        df, df_daily = await asyncio.gather(
            yahoo_history.get_ohlcv(symbol, days=30),
            yahoo_history.get_ohlcv_daily(symbol, days=90),
        )

        if df is None or len(df) < MIN_POINTS:
            close_s = price_history.get_series(coin_id)
            if close_s is None or len(close_s) < MIN_POINTS:
                close_s = await yahoo_history.get_close_series(symbol, days=30)
            if close_s is None or len(close_s) < MIN_POINTS:
                raise ValueError("Not enough price data")
            cs = close_s.reset_index(drop=True)
            z  = pd.Series([0.0] * len(cs), dtype=float)
            df = pd.DataFrame({"open": cs, "high": cs, "low": cs, "close": cs, "volume": z})

        close  = df["close"].astype(float).reset_index(drop=True)
        high   = df["high"].astype(float).reset_index(drop=True)
        low    = df["low"].astype(float).reset_index(drop=True)
        open_s = df["open"].astype(float).reset_index(drop=True)
        volume = df["volume"].astype(float).reset_index(drop=True)
        last   = float(close.iloc[-1])

        # ── Indicators ──────────────────────────────────────────────
        rsi_s               = _rsi_series(close)
        last_rsi            = _safe_last(rsi_s, 50.0)
        macd_v, macd_sig    = _macd(close)
        bb_u, bb_l          = _bbands(close)
        ema50               = _ema(close, 50)
        ema200              = _ema(close, 200) if len(close) >= 200 else None
        adx, di_pos, di_neg = _adx(high, low, close)
        stoch_k, stoch_d    = _stochastic(high, low, close)
        structure           = _market_structure(close)
        divergence          = _rsi_divergence(close, rsi_s)
        sr                  = _support_resistance(high, low, close)
        candle              = _candlestick_patterns(open_s, high, low, close)

        # Volume surge: last bar > 1.5× 20-bar average
        vol_ok    = bool(volume.sum() > 0)
        vol_sma   = float(volume.rolling(20).mean().iloc[-1]) if vol_ok else 0.0
        last_vol  = float(volume.iloc[-1]) if vol_ok else 0.0
        vol_surge = bool(last_vol > vol_sma * 1.5 and vol_sma > 0)

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
            ema50, ema200, adx, di_pos, di_neg,
            stoch_k, stoch_d, structure, divergence, vol_surge,
            mtf_trend=mtf["trend"],
            candle_signal=candle["signal"],
        )

        trend_label = "forte" if adx > 25 else ("debole" if adx < 20 else "moderato")

        return {
            "agent": "technical",
            "symbol": symbol,
            "score": score,
            "details": {
                "rsi":              round(last_rsi, 1),
                "macd_bullish":     macd_v > macd_sig,
                "bb_position":      _bb_pos(last, bb_u, bb_l),
                "ema50":            round(ema50, 2),
                "above_ema50":      last > ema50,
                "adx":              round(adx, 1),
                "trend_strength":   trend_label,
                "di_plus_above":    di_pos > di_neg,
                "stoch_k":          round(stoch_k, 1),
                "stoch_overbought": stoch_k > 80,
                "stoch_oversold":   stoch_k < 20,
                "market_structure": structure,
                "divergence":       divergence,
                "volume_surge":     vol_surge,
                "close":            round(last, 2),
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
            "signal": _signal(score),
            "error": None,
        }
    except Exception as e:
        return {"agent": "technical", "symbol": symbol, "score": 0,
                "details": {}, "signal": "NEUTRAL", "error": str(e)}


def _signal(score: float) -> str:
    if score > 0.3:  return "BUY"
    if score < -0.3: return "SELL"
    return "NEUTRAL"
