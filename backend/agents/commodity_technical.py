import asyncio
from agents.forex_technical import (
    fetch_ohlcv, _ema, _rsi_series, _safe_last, _macd, _bbands, _bb_pos, _sig,
    _adx, _stochastic, _market_structure, _rsi_divergence, _professional_score,
    _mtf_filter, _support_resistance, _candlestick_patterns, _empty_mtf,
)
from data.commodities import get_by_id


async def run(commodity_id: str) -> dict:
    comm = get_by_id(commodity_id)
    if not comm:
        return _err(commodity_id, "Commodity non trovata")
    try:
        df, df_daily = await asyncio.gather(
            fetch_ohlcv(comm["id"], interval="60m", yrange="10d"),
            fetch_ohlcv(comm["id"], interval="1d",  yrange="90d"),
        )
        if df.empty:
            return _err(commodity_id, "Nessun dato da Yahoo Finance")

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
            "symbol": commodity_id,
            "score": score,
            "details": {
                "rsi":              round(last_rsi, 1),
                "macd_bullish":     macd_v > macd_sig,
                "bb_position":      _bb_pos(last, bb_u, bb_l),
                "ema50":            round(ema50, 4),
                "above_ema50":      last > ema50,
                "adx":              round(adx, 1),
                "trend_strength":   trend_label,
                "di_plus_above":    di_pos > di_neg,
                "stoch_k":          round(stoch_k, 1),
                "stoch_overbought": stoch_k > 80,
                "stoch_oversold":   stoch_k < 20,
                "market_structure": structure,
                "divergence":       divergence,
                "close":            round(last, 4),
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
        return _err(commodity_id, str(e))


def _err(cid: str, msg: str) -> dict:
    return {"agent": "technical", "symbol": cid, "score": 0, "details": {}, "signal": "NEUTRAL", "error": msg}
