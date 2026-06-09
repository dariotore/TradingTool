"""
Economic calendar guard for forex signals.
Source: ForexFactory free weekly JSON — no API key.
URL: https://nfs.faireconomy.media/ff_calendar_thisweek.json

Logic:
  Suppress BUY/SELL signals within ±30 min of a HIGH-impact event
  for either currency in a pair. Cached for 1 hour.
"""
import time
import httpx
from datetime import datetime, timezone, timedelta

_FF_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
_CACHE: dict = {"events": [], "ts": 0.0}
_TTL = 3600  # seconds

# ForexFactory uses ISO country codes that match our currency codes directly
_KNOWN_CCYS = {"USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "NZD"}


async def _fetch_calendar() -> list[dict]:
    now = time.time()
    if now - _CACHE["ts"] < _TTL and _CACHE["events"]:
        return _CACHE["events"]
    try:
        async with httpx.AsyncClient(timeout=10,
                                     headers={"User-Agent": "TradingPlatform/1.0"}) as client:
            r = await client.get(_FF_URL)
            r.raise_for_status()
            events = r.json()
        high = [e for e in events
                if e.get("impact", "").lower() == "high"
                and e.get("country", "").upper() in _KNOWN_CCYS]
        _CACHE["events"] = high
        _CACHE["ts"] = now
        return high
    except Exception:
        return _CACHE.get("events", [])


async def check_event_risk(base: str, quote: str, window_minutes: int = 30) -> dict:
    """
    Returns details about any HIGH-impact event within ±window_minutes for
    either currency in the pair. Returns {"has_event": False} if all clear.
    """
    events = await _fetch_calendar()
    now    = datetime.now(timezone.utc)
    window = timedelta(minutes=window_minutes)

    relevant = []
    for ev in events:
        ccy = ev.get("country", "").upper()
        if ccy not in (base, quote):
            continue
        try:
            ev_time = datetime.fromisoformat(ev["date"].replace("Z", "+00:00"))
            diff    = ev_time - now
            if -window <= diff <= window:
                relevant.append({
                    "currency":      ccy,
                    "title":         ev.get("title", ""),
                    "minutes_until": round(diff.total_seconds() / 60),
                    "event_time":    ev_time.isoformat(),
                })
        except Exception:
            continue

    if not relevant:
        return {"has_event": False}

    primary = min(relevant, key=lambda e: abs(e["minutes_until"]))
    return {
        "has_event":     True,
        "event":         primary["title"],
        "currency":      primary["currency"],
        "minutes_until": primary["minutes_until"],
        "all_events":    relevant,
    }
