import os
import json

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

WEIGHTS = {
    "fundamental": 0.25,
    "technical":   0.35,
    "news":        0.20,
    "risk":        0.20,
}


async def run(symbol: str, agent_results: list[dict]) -> dict:
    results_by_agent = {r["agent"]: r for r in agent_results if r.get("agent")}

    weighted_score = round(sum(
        results_by_agent.get(name, {}).get("score", 0) * w
        for name, w in WEIGHTS.items()
    ), 3)

    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if ANTHROPIC_AVAILABLE and api_key and api_key != "your_key_here":
        recommendation = await _claude_synthesis(symbol, results_by_agent, weighted_score, api_key)
    else:
        recommendation = _rule_based_synthesis(symbol, results_by_agent, weighted_score)

    text_analysis = recommendation.pop("text_analysis", None) or _generate_text(symbol, results_by_agent, recommendation)

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
            for name, r in results_by_agent.items()
        },
        "risk_details": results_by_agent.get("risk", {}).get("details", {}),
        "error": None,
    }


# ── Rule-based ─────────────────────────────────────────────────────

def _rule_based_synthesis(symbol: str, results: dict, score: float) -> dict:
    risk_signal = results.get("risk", {}).get("signal", "ACCEPTABLE")

    if risk_signal == "HIGH_RISK":
        return {"action": "AVOID", "confidence": 0.8,
                "reasoning": f"Rischio troppo elevato per {symbol}. Volatilità o drawdown eccessivi."}

    if score > 0.35:
        action, conf = "BUY", min(0.95, 0.5 + score)
    elif score < -0.35:
        action, conf = "SELL", min(0.95, 0.5 + abs(score))
    else:
        action, conf = "HOLD", 0.5

    reasoning = _build_reasoning(results, action)
    if risk_signal == "CAUTION" and action == "BUY":
        conf = round(conf * 0.8, 2)
        reasoning += " Attenzione: volatilità elevata, ridurre la size della posizione."

    return {"action": action, "confidence": round(conf, 2), "reasoning": reasoning}


def _build_reasoning(results: dict, action: str) -> str:
    signals = []
    for name, label in [("fundamental", "Fondamentale"), ("technical", "Tecnica"), ("news", "Sentiment")]:
        sig = results.get(name, {}).get("signal", "NEUTRAL")
        signals.append(f"{label}: {sig}")
    return " | ".join(signals)


def _generate_text(symbol: str, results: dict, rec: dict) -> str:
    """Build a detailed Italian analysis paragraph from agent data."""
    parts = []

    td = (results.get("technical") or {}).get("details") or {}
    fd = (results.get("fundamental") or {}).get("details") or {}
    rd = (results.get("risk") or {}).get("details") or {}

    # ── Technical ──
    rsi = td.get("rsi")
    if rsi is not None:
        if rsi < 30:
            parts.append(f"L'RSI è a {rsi:.0f}, in zona di ipervenduto: storicamente un segnale di possibile rimbalzo.")
        elif rsi > 70:
            parts.append(f"L'RSI è a {rsi:.0f}, in zona di ipercomprato: il momentum rialzista potrebbe esaurirsi a breve.")
        else:
            parts.append(f"L'RSI è a {rsi:.0f}, in territorio neutrale senza segnali estremi.")

        if td.get("macd_bullish") is True:
            parts.append("Il MACD è al di sopra della linea di segnale, confermando una pressione rialzista di breve termine.")
        elif td.get("macd_bullish") is False:
            parts.append("Il MACD si trova sotto la linea di segnale, riflettendo una pressione ribassista.")

        bb = td.get("bb_position", "middle")
        if bb == "near_lower":
            parts.append("Il prezzo è vicino alla banda inferiore di Bollinger, zona che storicamente funge da supporto dinamico.")
        elif bb == "near_upper":
            parts.append("Il prezzo ha toccato la banda superiore di Bollinger, che può agire come resistenza.")

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

    # ── Risk ──
    risk_level = rd.get("risk_level")
    vol = rd.get("volatility_daily_pct") or rd.get("volatilita_giorn_pct")
    max_dd = rd.get("max_drawdown_pct")

    if risk_level and vol:
        risk_desc = {"LOW": "basso", "MEDIUM": "moderato", "HIGH": "elevato"}.get(risk_level, risk_level)
        parts.append(f"Il profilo di rischio è {risk_desc}, con una volatilità giornaliera media del {vol:.2f}%.")
    if max_dd is not None and max_dd < -5:
        parts.append(f"Il drawdown massimo nel periodo osservato è stato del {abs(max_dd):.1f}%.")

    sl = rd.get("suggested_stop_loss")
    tp = rd.get("suggested_take_profit")
    if sl and tp:
        parts.append(f"I livelli operativi suggeriti sono: stop loss a {_fmt(sl)}, take profit a {_fmt(tp)}.")

    # ── Conclusion ──
    action = rec.get("action", "HOLD")
    conf   = rec.get("confidence", 0.5)
    labels = {"BUY": "acquisto", "SELL": "vendita", "HOLD": "attesa", "AVOID": "evitare l'esposizione"}
    parts.append(
        f"Tenendo conto di tutti i fattori, la raccomandazione è di {labels.get(action, action)} "
        f"con una confidenza del {conf * 100:.0f}%."
    )

    return " ".join(parts) if parts else "Analisi non disponibile: dati insufficienti."


def _fmt(v: float) -> str:
    if v >= 1000: return f"${v:,.0f}"
    if v >= 1:    return f"{v:.4f}"
    return f"{v:.5f}"


# ── Claude API ─────────────────────────────────────────────────────

async def _claude_synthesis(symbol: str, results: dict, score: float, api_key: str) -> dict:
    client = anthropic.AsyncAnthropic(api_key=api_key)

    summary = "\n".join([
        f"- {name}: score={r.get('score', 0):.3f}, signal={r.get('signal', 'N/A')}, details={r.get('details', {})}"
        for name, r in results.items()
    ])

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=600,
        messages=[{
            "role": "user",
            "content": (
                f"Sei un analista finanziario esperto. Analizza questi dati per {symbol}.\n\n"
                f"Score aggregato: {score}\nDati agenti:\n{summary}\n\n"
                "Rispondi SOLO con JSON valido (nessun testo fuori dal JSON):\n"
                '{"action":"BUY|SELL|HOLD|AVOID","confidence":0.0-1.0,"reasoning":"2-3 frasi brevi in italiano",'
                '"text_analysis":"UN paragrafo dettagliato in italiano (max 120 parole) che analizza RSI, MACD, trend, rischio e fornisce la raccomandazione operativa"}'
            )
        }]
    )

    text = message.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())
