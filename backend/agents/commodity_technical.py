from agents.forex_technical import fetch_ohlcv, _rsi, _macd, _bbands, _compute_score, _bb_pos, _sig
from data.commodities import get_by_id


async def run(commodity_id: str) -> dict:
    comm = get_by_id(commodity_id)
    if not comm:
        return _err(commodity_id, "Commodity non trovata")
    try:
        df = await fetch_ohlcv(comm["id"], interval="60m", yrange="5d")
        if df.empty:
            return _err(commodity_id, "Nessun dato da Yahoo Finance")

        close = df["close"]
        rsi        = _rsi(close)
        macd_v, ms = _macd(close)
        bb_u, bb_l = _bbands(close)
        last_close = float(close.iloc[-1])
        score      = _compute_score(rsi, macd_v, ms, last_close, bb_u, bb_l)

        change_24h = None
        if len(close) >= 24:
            p24 = float(close.iloc[-24])
            if p24 != 0:
                change_24h = round((last_close - p24) / p24 * 100, 3)

        return {
            "agent": "technical",
            "symbol": commodity_id,
            "score": score,
            "details": {
                "rsi":                  round(rsi, 2),
                "macd":                 round(macd_v, 4),
                "macd_signal":          round(ms, 4),
                "macd_bullish":         macd_v > ms,
                "bb_upper":             round(bb_u, 4),
                "bb_lower":             round(bb_l, 4),
                "close":                round(last_close, 4),
                "bb_position":          _bb_pos(last_close, bb_u, bb_l),
                "price_change_24h_pct": change_24h,
            },
            "signal": _sig(score),
            "error": None,
        }
    except Exception as e:
        return _err(commodity_id, str(e))


def _err(cid: str, msg: str) -> dict:
    return {"agent": "technical", "symbol": cid, "score": 0, "details": {}, "signal": "NEUTRAL", "error": msg}
