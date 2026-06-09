"""
Telegram bot integration — sends BUY/SELL trading signals.

Setup:
  1. Create a bot: open @BotFather on Telegram → /newbot → copy the token
  2. Get your chat_id: message @userinfobot → it replies with your ID
  3. Add to backend/.env:
       TELEGRAM_BOT_TOKEN=123456:ABCdefGHIjklMNOpqrSTUvwxYZ
       TELEGRAM_CHAT_ID=987654321
  4. Optionally set TELEGRAM_SIGNALS=SELL to also receive SELL alerts
     (default: both BUY and SELL are sent)
"""

import os
import httpx

TELEGRAM_API = "https://api.telegram.org"

EMOJI = {"BUY": "🟢", "STRONG_BUY": "🚀", "SELL": "🔴", "STRONG_SELL": "🆘", "HOLD": "🟡", "AVOID": "⛔"}
LABEL = {"BUY": "COMPRA", "STRONG_BUY": "COMPRA FORTE", "SELL": "VENDI", "STRONG_SELL": "VENDI FORTE"}

MARKET_TAG = {"crypto": "#Crypto", "forex": "#Forex", "commodity": "#MateriePrime"}


def _fmt_price(v: float, is_forex: bool) -> str:
    if is_forex:
        return f"{v:.5f}" if v < 10 else f"{v:.3f}"
    if v >= 1000:
        return f"${v:,.0f}"
    if v >= 1:
        return f"${v:.3f}"
    return f"${v:.6f}"


async def send_signal(
    symbol: str,
    name: str,
    recommendation: str,
    price: float,
    sl: float | None,
    tp: float | None,
    confidence: float,
    market: str = "crypto",
) -> bool:
    token   = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id or token == "your_bot_token":
        return False

    is_forex = market in ("forex", "commodity")
    emoji  = EMOJI.get(recommendation, "⚪")
    label  = LABEL.get(recommendation, recommendation)
    p_str  = _fmt_price(price, is_forex)
    sl_str = _fmt_price(sl, is_forex) if sl else "—"
    tp_str = _fmt_price(tp, is_forex) if tp else "—"
    tag    = MARKET_TAG.get(market, "#Trading")
    conf   = int(confidence * 100)

    text = (
        f"{emoji} *{label}* — {name}\n"
        f"💰 Prezzo: `{p_str}`\n"
        f"🛑 Stop Loss: `{sl_str}`\n"
        f"🎯 Take Profit: `{tp_str}`\n"
        f"📊 Confidenza: {conf}%\n"
        f"{tag} `{symbol}`"
    )

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.post(
                f"{TELEGRAM_API}/bot{token}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"},
            )
            return r.status_code == 200
    except Exception:
        return False


async def send_text(message: str) -> bool:
    """Send a plain text message (for startup notifications, errors, etc.)."""
    token   = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id or token == "your_bot_token":
        return False
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.post(
                f"{TELEGRAM_API}/bot{token}/sendMessage",
                json={"chat_id": chat_id, "text": message, "parse_mode": "Markdown"},
            )
            return r.status_code == 200
    except Exception:
        return False
