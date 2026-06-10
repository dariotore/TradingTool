import os
import json
import time
import httpx
from datetime import datetime, timezone

try:
    from agents import forex_calendar as _cal
    _CAL_AVAILABLE = True
except ImportError:
    _CAL_AVAILABLE = False

try:
    from data.forex import get_by_id as _forex_get
    _FOREX_REG_AVAILABLE = True
except ImportError:
    _FOREX_REG_AVAILABLE = False

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

try:
    from utils import signal_db as _sdb
    LEARNING_AVAILABLE = True
except ImportError:
    LEARNING_AVAILABLE = False

# ── BTC dominance cache (5-min TTL) ──────────────────────────────────────────
_btc_cache: dict = {"change": 0.0, "ts": 0.0}


async def _get_btc_4h_change() -> float:
    """BTC 4h price change, cached 5 minutes. Returns % change (negative = drop)."""
    now = time.time()
    if now - _btc_cache["ts"] < 300:
        return _btc_cache["change"]
    try:
        async with httpx.AsyncClient(timeout=8, headers={"User-Agent": "Mozilla/5.0"}) as client:
            r = await client.get(
                "https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD",
                params={"interval": "1h", "range": "5d"},
            )
            r.raise_for_status()
            data = r.json()
        closes = [c for c in data["chart"]["result"][0]["indicators"]["quote"][0]["close"]
                  if c is not None]
        if len(closes) >= 5:
            change = (closes[-1] - closes[-5]) / closes[-5] * 100
            _btc_cache["change"] = round(change, 2)
            _btc_cache["ts"] = now
    except Exception:
        pass
    return _btc_cache["change"]


# ── Crypto weights (momentum/sentiment-driven) ────────────────────────────────
WEIGHTS_TRENDING = {"fundamental": 0.20, "technical": 0.45, "news": 0.15, "risk": 0.20}
WEIGHTS_RANGING  = {"fundamental": 0.30, "technical": 0.30, "news": 0.20, "risk": 0.20}
WEIGHTS_DEFAULT  = {"fundamental": 0.25, "technical": 0.35, "news": 0.20, "risk": 0.20}

# ── Forex weights (macro/central-bank-driven + COT positioning) ───────────────
# COT gets higher weight in ranging markets (positioning extremes = mean-reversion)
# and lower weight in trending markets (trend overrides speculative crowding).
FOREX_WEIGHTS_TRENDING = {"fundamental": 0.25, "technical": 0.35, "news": 0.10, "risk": 0.15, "cot": 0.15}
FOREX_WEIGHTS_RANGING  = {"fundamental": 0.30, "technical": 0.20, "news": 0.10, "risk": 0.15, "cot": 0.25}
FOREX_WEIGHTS_DEFAULT  = {"fundamental": 0.27, "technical": 0.25, "news": 0.13, "risk": 0.15, "cot": 0.20}


def _select_weights(results: dict, market: str = "crypto") -> dict:
    adx = (results.get("technical") or {}).get("details", {}).get("adx")
    if market == "forex":
        if adx is None:      return FOREX_WEIGHTS_DEFAULT
        if adx > 25:         return FOREX_WEIGHTS_TRENDING
        if adx < 20:         return FOREX_WEIGHTS_RANGING
        return FOREX_WEIGHTS_DEFAULT
    else:
        if adx is None:      return WEIGHTS_DEFAULT
        if adx > 25:         return WEIGHTS_TRENDING
        if adx < 20:         return WEIGHTS_RANGING
        return WEIGHTS_DEFAULT


def _forex_session_factor() -> float:
    """
    Reduce confidence during Asian session (00:00–07:00 UTC) for forex signals.
    London 07:00-16:00 UTC and NY 13:00-21:00 UTC overlap is the peak window.
    Outside this window: liquidity is thinner and spreads are wider.
    """
    hour = datetime.now(timezone.utc).hour
    if 7 <= hour < 21:
        return 1.0    # London / NY session — full confidence
    return 0.85       # Asian session — reduce confidence 15%


async def run(symbol: str, agent_results: list[dict], market: str = "crypto") -> dict:
    results = {r["agent"]: r for r in agent_results if r.get("agent")}

    # Regime must be known before weight selection (dynamic weights are regime-scoped)
    td     = (results.get("technical") or {}).get("details", {})
    adx    = td.get("adx", 20.0) or 20.0
    regime = "trending" if adx > 25 else ("ranging" if adx < 20 else "transitional")

    # Static weights first; override with learned per-agent weights when data is sufficient
    weights = _select_weights(results, market)
    if LEARNING_AVAILABLE:
        dyn_w = _sdb.get_dynamic_weights(symbol, regime, list(weights.keys()), market)
        if dyn_w:
            weights = dyn_w

    weighted_score = round(sum(
        results.get(name, {}).get("score", 0) * w
        for name, w in weights.items()
    ), 3)

    # ── Learning: get historical accuracy context ──────────────────
    history_summary = _sdb.get_recent_signal_summary(symbol) if LEARNING_AVAILABLE else None
    mult    = _sdb.get_confidence_multiplier(symbol, regime) if LEARNING_AVAILABLE else 1.0
    acc_stats = _sdb.get_accuracy_stats(symbol=symbol, regime=regime) if LEARNING_AVAILABLE else {}

    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if ANTHROPIC_AVAILABLE and api_key and api_key != "your_key_here":
        recommendation = await _claude_synthesis(symbol, results, weighted_score, api_key, history_summary, market)
    else:
        recommendation = _rule_based_synthesis(symbol, results, weighted_score)

    # ── Economic calendar: suppress forex signals during high-impact events ──
    if market == "forex" and _CAL_AVAILABLE and _FOREX_REG_AVAILABLE:
        pair = _forex_get(symbol)
        if pair:
            cal = await _cal.check_event_risk(pair["base"], pair["quote"])
            if cal.get("has_event") and recommendation["action"] not in ("HOLD", "AVOID"):
                mins  = cal["minutes_until"]
                evt   = cal["event"]
                ccy   = cal["currency"]
                label = "tra" if mins > 0 else "da"
                recommendation["action"]     = "HOLD"
                recommendation["confidence"] = round(recommendation["confidence"] * 0.50, 2)
                recommendation["reasoning"] += (
                    f" [BLOCCO CALENDARIO: {evt} ({ccy}) {label} "
                    f"{abs(mins)} min — segnale sospeso per volatilità da dati]"
                )

    # ── Volume confirmation: penalise crypto BUY without volume surge ─────────
    if market == "crypto":
        vol_surge = (results.get("technical") or {}).get("details", {}).get("volume_surge", False)
        if not vol_surge and recommendation["action"] in ("BUY", "STRONG_BUY"):
            recommendation["confidence"] = round(recommendation["confidence"] * 0.85, 2)
            recommendation["reasoning"] += " [volume sotto media 20 periodi: confidenza ridotta]"

    # ── BTC dominance filter: suppress altcoin BUY during BTC sell-off ──────
    if market == "crypto" and not symbol.upper().startswith("BTC"):
        btc_change = await _get_btc_4h_change()
        if btc_change < -3.0 and recommendation["action"] in ("BUY", "STRONG_BUY"):
            recommendation["action"] = "HOLD"
            recommendation["confidence"] = round(recommendation["confidence"] * 0.70, 2)
            recommendation["reasoning"] += (
                f" [BTC in calo del {btc_change:.1f}% nelle ultime 4h: "
                "segnale BUY soppresso per altcoin]"
            )

    # ── Forex session penalty: Asian session = lower liquidity ─────
    if market == "forex":
        session_factor = _forex_session_factor()
        if session_factor < 1.0 and recommendation["action"] not in ("HOLD", "AVOID"):
            recommendation["confidence"] = round(recommendation["confidence"] * session_factor, 2)
            recommendation["reasoning"] += " [sessione asiatica: liquidità ridotta, confidenza abbassata]"

    # ── Apply adaptive confidence multiplier (regime-level) ────────
    if mult != 1.0 and recommendation["action"] not in ("HOLD", "AVOID"):
        old_conf = recommendation["confidence"]
        recommendation["confidence"] = min(0.95, round(old_conf * mult, 2))
        if mult < 0.85:
            recommendation["reasoning"] += " [storico: accuracy bassa in questo regime, confidenza ridotta]"
        elif mult > 1.10:
            recommendation["reasoning"] += " [storico: accuracy elevata in questo regime, confidenza aumentata]"

    # ── Action-specific multiplier (BUY vs SELL accuracy) ──────────
    if LEARNING_AVAILABLE and recommendation["action"] not in ("HOLD", "AVOID"):
        action_mult = _sdb.get_action_multiplier(symbol, recommendation["action"])
        if action_mult != 1.0:
            recommendation["confidence"] = min(0.95, round(recommendation["confidence"] * action_mult, 2))
            direction = "BUY" if recommendation["action"] in ("BUY", "STRONG_BUY") else "SELL"
            if action_mult < 0.90:
                recommendation["reasoning"] += f" [storico {direction}: accuracy bassa, confidenza ridotta]"
            elif action_mult > 1.10:
                recommendation["reasoning"] += f" [storico {direction}: accuracy elevata, confidenza aumentata]"

    # ── Minimum confidence gate: weak signals → HOLD ────────────────
    if recommendation["action"] not in ("HOLD", "AVOID") and recommendation["confidence"] < 0.40:
        recommendation["action"]     = "HOLD"
        recommendation["confidence"] = round(recommendation["confidence"], 2)
        recommendation["reasoning"] += " [confidenza insufficiente: segnale declassato a HOLD]"

    text_analysis = recommendation.pop("text_analysis", None) or _generate_text(symbol, results, recommendation)

    # ── Use S/R levels for SL/TP (more precise than vol-based) ─────
    risk_det = dict((results.get("risk") or {}).get("details") or {})
    sup      = td.get("nearest_support")
    res_lvl  = td.get("nearest_resistance")
    if sup and res_lvl:
        if weighted_score >= 0:
            risk_det["suggested_stop_loss"]   = sup
            risk_det["suggested_take_profit"] = res_lvl
        else:
            risk_det["suggested_stop_loss"]   = res_lvl
            risk_det["suggested_take_profit"] = sup

    return {
        "agent": "synthesis",
        "symbol": symbol,
        "weighted_score": weighted_score,
        "recommendation": recommendation["action"],
        "confidence": recommendation["confidence"],
        "reasoning": recommendation["reasoning"],
        "text_analysis": text_analysis,
        "agent_scores": {
            name: {"score": r.get("score", 0), "signal": r.get("signal", "N/A")}
            for name, r in results.items()
        },
        "risk_details": risk_det,
        "learning_stats": {
            "accuracy":     acc_stats.get("accuracy"),
            "sample_count": acc_stats.get("total", 0),
            "regime":       regime,
            "multiplier":   round(mult, 2),
        },
        "error": None,
    }


# ── Rule-based ──────────────────────────────────────────────────────────────

def _rule_based_synthesis(symbol: str, results: dict, score: float) -> dict:
    risk_signal = results.get("risk", {}).get("signal", "ACCEPTABLE")
    td          = (results.get("technical") or {}).get("details", {})
    adx         = td.get("adx", 20)
    divergence  = td.get("divergence", "none")
    mtf_trend   = td.get("mtf_trend", "neutral")
    is_ranging  = adx < 20

    if risk_signal == "HIGH_RISK":
        return {"action": "AVOID", "confidence": 0.8,
                "reasoning": _build_professional_reasoning(results, "AVOID")}

    # Base action from score
    if   score > 0.6:   action, conf = "STRONG_BUY",  min(0.95, 0.55 + score)
    elif score > 0.35:  action, conf = "BUY",          min(0.95, 0.50 + score)
    elif score < -0.6:  action, conf = "STRONG_SELL",  min(0.95, 0.55 + abs(score))
    elif score < -0.35: action, conf = "SELL",          min(0.95, 0.50 + abs(score))
    else:               action, conf = "HOLD",          0.50

    # Confluence: bull/bear signal count across non-risk agents
    bull = sum(1 for ag in ("fundamental", "technical", "news")
               if results.get(ag, {}).get("signal") in ("BUY", "STRONG_BUY"))
    bear = sum(1 for ag in ("fundamental", "technical", "news")
               if results.get(ag, {}).get("signal") in ("SELL", "STRONG_SELL"))

    if action in ("BUY",  "STRONG_BUY")  and bull >= 2: conf = min(0.95, conf + 0.07)
    if action in ("SELL", "STRONG_SELL") and bear >= 2: conf = min(0.95, conf + 0.07)
    if (action in ("BUY",  "STRONG_BUY")  and bull == 0) or \
       (action in ("SELL", "STRONG_SELL") and bear == 0):
        conf = round(conf * 0.85, 2)

    # MTF counter-trend penalty: going against the daily trend
    if mtf_trend == "down" and action in ("BUY",  "STRONG_BUY"):
        conf = round(conf * 0.80, 2)
        if action == "STRONG_BUY": action = "BUY"
    if mtf_trend == "up"   and action in ("SELL", "STRONG_SELL"):
        conf = round(conf * 0.80, 2)
        if action == "STRONG_SELL": action = "SELL"

    # Regime filter: no STRONG signals in ranging markets
    if is_ranging:
        if action == "STRONG_BUY":  action, conf = "BUY",  round(conf * 0.90, 2)
        if action == "STRONG_SELL": action, conf = "SELL", round(conf * 0.90, 2)

    # RSI divergence veto
    if divergence == "bearish" and action in ("BUY", "STRONG_BUY"):
        if action == "STRONG_BUY": action = "BUY"
        conf = round(conf * 0.80, 2)
    if divergence == "bullish" and action in ("SELL", "STRONG_SELL"):
        if action == "STRONG_SELL": action = "SELL"
        conf = round(conf * 0.80, 2)

    # Risk caution penalty
    if risk_signal == "CAUTION" and action in ("BUY", "STRONG_BUY"):
        conf = round(conf * 0.80, 2)

    return {
        "action": action,
        "confidence": round(conf, 2),
        "reasoning": _build_professional_reasoning(results, action),
    }


def _build_professional_reasoning(results: dict, action: str) -> str:
    td = (results.get("technical") or {}).get("details", {})
    rd = (results.get("risk")      or {}).get("details", {})
    parts = []

    # ADX + MTF context
    adx       = td.get("adx")
    structure = td.get("market_structure", "unknown")
    mtf_trend = td.get("mtf_trend", "neutral")
    adx_daily = td.get("adx_daily")
    if adx is not None:
        regime   = "trend" if adx > 25 else ("laterale" if adx < 20 else "moderato")
        mtf_txt  = f", MTF: {mtf_trend}" if mtf_trend != "neutral" else ""
        parts.append(f"ADX {adx:.0f} ({regime}, struttura: {structure}{mtf_txt}).")

    # S/R levels
    sup     = td.get("nearest_support")
    res_lvl = td.get("nearest_resistance")
    if sup and res_lvl:
        parts.append(f"Supporto: {_fmt(sup)} | Resistenza: {_fmt(res_lvl)}.")

    # Divergence
    div = td.get("divergence", "none")
    if div == "bearish":
        parts.append("Divergenza RSI ribassista: attenzione a posizioni long.")
    elif div == "bullish":
        parts.append("Divergenza RSI rialzista: potenziale inversione al rialzo.")

    # Candlestick patterns
    patterns   = td.get("candle_patterns", [])
    candle_sig = td.get("candle_signal", "neutral")
    if patterns:
        parts.append(f"Pattern: {', '.join(patterns)} ({candle_sig}).")

    # Risk level
    risk_level = rd.get("risk_level")
    sortino    = rd.get("sortino_ratio")
    if risk_level:
        risk_it = {"LOW": "basso", "MEDIUM": "moderato", "HIGH": "elevato"}.get(risk_level, risk_level)
        sor_txt = f", Sortino {sortino}" if sortino is not None else ""
        parts.append(f"Rischio {risk_it}{sor_txt}.")

    return " ".join(parts)


def _generate_text(symbol: str, results: dict, rec: dict) -> str:
    parts = []

    td = (results.get("technical")   or {}).get("details") or {}
    fd = (results.get("fundamental") or {}).get("details") or {}
    rd = (results.get("risk")        or {}).get("details") or {}

    # ── RSI ──
    rsi = td.get("rsi")
    if rsi is not None:
        if rsi < 30:
            parts.append(f"L'RSI è a {rsi:.0f}, in zona di ipervenduto: potenziale rimbalzo tecnico.")
        elif rsi > 70:
            parts.append(f"L'RSI è a {rsi:.0f}, in zona di ipercomprato: attenzione a un'inversione.")
        else:
            parts.append(f"L'RSI è a {rsi:.0f}, in territorio neutrale.")

    # ── MACD ──
    if td.get("macd_bullish") is True:
        parts.append("Il MACD è sopra la linea di segnale, confermando momentum rialzista.")
    elif td.get("macd_bullish") is False:
        parts.append("Il MACD è sotto la linea di segnale, indicando pressione ribassista.")

    # ── Bollinger Bands ──
    bb = td.get("bb_position", "middle")
    if bb == "near_lower":
        parts.append("Il prezzo è vicino alla banda inferiore di Bollinger (supporto dinamico).")
    elif bb == "near_upper":
        parts.append("Il prezzo ha raggiunto la banda superiore di Bollinger (resistenza dinamica).")

    # ── ADX / Stochastic ──
    adx       = td.get("adx")
    trend_str = td.get("trend_strength")
    structure = td.get("market_structure", "")
    if adx is not None and trend_str:
        parts.append(f"L'ADX è a {adx:.0f} (trend {trend_str}), struttura di mercato: {structure}.")

    stoch_k = td.get("stoch_k")
    if stoch_k is not None:
        if td.get("stoch_oversold"):
            parts.append(f"Lo Stocastico (%K={stoch_k:.0f}) è in zona di ipervenduto: possibile segnale di acquisto.")
        elif td.get("stoch_overbought"):
            parts.append(f"Lo Stocastico (%K={stoch_k:.0f}) è in zona di ipercomprato.")

    # ── Multi-timeframe ──
    mtf_trend = td.get("mtf_trend", "neutral")
    adx_daily = td.get("adx_daily")
    struct_d  = td.get("structure_daily", "")
    if mtf_trend != "neutral":
        dir_d    = "rialzista" if mtf_trend == "up" else "ribassista"
        adx_txt  = f" (ADX daily: {adx_daily:.0f})" if adx_daily is not None else ""
        struct_t = f", struttura: {struct_d}" if struct_d else ""
        parts.append(f"Il trend giornaliero è {dir_d}{adx_txt}{struct_t}.")

    # ── RSI Divergence ──
    divergence = td.get("divergence", "none")
    if divergence == "bullish":
        parts.append("Rilevata divergenza RSI rialzista: prezzo fa nuovi minimi ma RSI si risolleva — possibile inversione.")
    elif divergence == "bearish":
        parts.append("Rilevata divergenza RSI ribassista: prezzo sale ma RSI non conferma — possibile esaurimento del rialzo.")

    # ── Candlestick patterns ──
    patterns   = td.get("candle_patterns", [])
    candle_sig = td.get("candle_signal", "neutral")
    if patterns:
        p_it = {
            "hammer":            "hammer",
            "shooting_star":     "shooting star",
            "bullish_engulfing": "engulfing rialzista",
            "bearish_engulfing": "engulfing ribassista",
            "morning_star":      "morning star",
            "evening_star":      "evening star",
            "doji":              "doji",
        }
        p_names = ", ".join(p_it.get(p, p) for p in patterns)
        sig_it  = {"bullish": "rialzista", "bearish": "ribassista"}.get(candle_sig, "neutro")
        parts.append(f"Pattern candlestick: {p_names} — segnale {sig_it}.")

    # ── S/R levels ──
    sup     = td.get("nearest_support")
    res_lvl = td.get("nearest_resistance")
    if sup and res_lvl:
        parts.append(f"Supporto dinamico a {_fmt(sup)}, resistenza a {_fmt(res_lvl)}.")

    # ── Fundamental ──
    p24  = fd.get("price_change_24h_pct")
    p7d  = fd.get("price_change_7d_pct")  or fd.get("cambio_7g_pct")
    p30d = fd.get("price_change_30d_pct") or fd.get("cambio_30g_pct")
    rank = fd.get("market_cap_rank")

    if p24 is not None:
        dir24 = "avanzato" if p24 > 0 else "ceduto"
        parts.append(f"Nelle ultime 24 ore il valore ha {dir24} del {abs(p24):.2f}%.")
    if p7d is not None:
        dir7 = "positiva" if p7d > 0 else "negativa"
        parts.append(f"La tendenza settimanale è {dir7} ({p7d:+.2f}%).")
    if p30d is not None:
        dir30 = "guadagnato" if p30d > 0 else "perso"
        parts.append(f"Nel mese ha {dir30} il {abs(p30d):.2f}%.")
    if rank:
        parts.append(f"Attualmente è al #{rank} per capitalizzazione di mercato.")

    # ── Risk metrics ──
    risk_level = rd.get("risk_level")
    vol        = rd.get("volatility_daily_pct") or rd.get("volatilita_giorn_pct")
    max_dd     = rd.get("max_drawdown_pct")
    sharpe     = rd.get("sharpe_ratio")
    sortino    = rd.get("sortino_ratio")
    var95      = rd.get("var_95_pct")

    if risk_level and vol:
        risk_desc = {"LOW": "basso", "MEDIUM": "moderato", "HIGH": "elevato"}.get(risk_level, risk_level)
        parts.append(f"Profilo di rischio {risk_desc}, volatilità giornaliera del {vol:.2f}%.")
    if sharpe is not None:
        sor_txt = f", Sortino {sortino}" if sortino is not None else ""
        parts.append(f"Sharpe ratio: {sharpe}{sor_txt}.")
    if var95 is not None:
        parts.append(f"VaR 95% giornaliero: {abs(var95):.2f}%.")
    if max_dd is not None and max_dd < -5:
        parts.append(f"Drawdown massimo nel periodo: {abs(max_dd):.1f}%.")

    sl = rd.get("suggested_stop_loss")
    tp = rd.get("suggested_take_profit")
    if sl and tp:
        parts.append(f"Livelli operativi: stop loss a {_fmt(sl)}, take profit a {_fmt(tp)}.")

    # ── News sentiment ──
    nd      = (results.get("news") or {}).get("details") or {}
    bd      = nd.get("sentiment_breakdown") or {}
    n_pos   = bd.get("positive", 0)
    n_neg   = bd.get("negative", 0)
    n_total = nd.get("articles_found", 0)
    if n_total > 0:
        if n_pos > n_neg * 1.5:
            parts.append(f"Sentiment notizie prevalentemente positivo ({n_pos}/{n_total} articoli favorevoli).")
        elif n_neg > n_pos * 1.5:
            parts.append(f"Sentiment notizie prevalentemente negativo ({n_neg}/{n_total} articoli avversi).")
        else:
            parts.append(f"Sentiment delle notizie misto ({n_total} articoli analizzati).")

    # ── Conclusion ──
    action = rec.get("action", "HOLD")
    conf   = rec.get("confidence", 0.5)
    labels = {
        "BUY": "acquisto", "STRONG_BUY": "acquisto forte",
        "SELL": "vendita", "STRONG_SELL": "vendita forte",
        "HOLD": "attesa",  "AVOID": "evitare l'esposizione",
    }
    parts.append(
        f"Tenendo conto di tutti i fattori, la raccomandazione è di {labels.get(action, action)} "
        f"con una confidenza del {conf * 100:.0f}%."
    )

    return " ".join(parts) if parts else "Analisi non disponibile: dati insufficienti."


def _fmt(v: float) -> str:
    if v >= 1000: return f"${v:,.0f}"
    if v >= 1:    return f"{v:.4f}"
    return f"{v:.5f}"


# ── Claude API ──────────────────────────────────────────────────────────────

async def _claude_synthesis(symbol: str, results: dict, score: float, api_key: str,
                            history_summary: str | None = None,
                            market: str = "crypto") -> dict:
    client = anthropic.AsyncAnthropic(api_key=api_key)

    td         = (results.get("technical") or {}).get("details", {})
    adx        = td.get("adx", "N/A")
    structure  = td.get("market_structure", "N/A")
    divergence = td.get("divergence", "none")
    mtf_trend  = td.get("mtf_trend", "neutral")
    adx_daily  = td.get("adx_daily", "N/A")
    sup        = td.get("nearest_support")
    res_lvl    = td.get("nearest_resistance")
    patterns   = td.get("candle_patterns", [])

    regime = "trending" if isinstance(adx, (int, float)) and adx > 25 else \
             ("ranging" if isinstance(adx, (int, float)) and adx < 20 else "transitional")

    summary = "\n".join([
        f"- {name}: score={r.get('score', 0):.3f}, signal={r.get('signal', 'N/A')}, details={r.get('details', {})}"
        for name, r in results.items()
    ])

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=700,
        messages=[{
            "role": "user",
            "content": (
                f"Sei un analista finanziario professionista. Analizza questi dati per {symbol} "
                f"(mercato: {market}).\n\n"
                f"Score aggregato: {score}\n"
                f"Regime orario: {regime} (ADX={adx}, struttura={structure})\n"
                f"MTF daily: trend={mtf_trend}, ADX daily={adx_daily}\n"
                f"Divergenza RSI: {divergence}\n"
                f"Supporto: {sup}, Resistenza: {res_lvl}\n"
                f"Pattern candlestick: {patterns}\n"
                f"Dati agenti:\n{summary}\n\n"
                + (f"Storico segnali (auto-apprendimento):\n{history_summary}\n\n" if history_summary else "")
                + "Regole:\n"
                "- In regime ranging: evita STRONG_BUY/STRONG_SELL\n"
                "- MTF daily bearish + BUY orario: abbassa confidenza\n"
                "- Con divergenza bearish: non raccomandare BUY/STRONG_BUY\n"
                "- Con divergenza bullish: non raccomandare SELL/STRONG_SELL\n"
                "- Usa supporto/resistenza per contestualizzare SL/TP\n\n"
                "Rispondi SOLO con JSON valido (nessun testo fuori dal JSON):\n"
                '{"action":"STRONG_BUY|BUY|HOLD|SELL|STRONG_SELL|AVOID","confidence":0.0-1.0,'
                '"reasoning":"2-3 frasi brevi in italiano con ADX, MTF, S/R e divergenza",'
                '"text_analysis":"UN paragrafo dettagliato in italiano (max 150 parole) che analizza '
                'ADX/regime/MTF, RSI, Stochastic, MACD, divergenze, pattern candlestick, '
                'supporto/resistenza, rischio (Sharpe/Sortino/VaR) e fornisce la raccomandazione operativa"}'
            )
        }]
    )

    text = message.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    try:
        return json.loads(text.strip())
    except (json.JSONDecodeError, KeyError, ValueError):
        return _rule_based_synthesis(symbol, results, score)
