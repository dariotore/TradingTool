"""
In-memory circular price buffer.
The fundamental agent pushes one price per refresh cycle (~60s).
Technical and risk agents read from this buffer — no extra API calls.
"""
from collections import deque
import pandas as pd

MAX_POINTS = 120  # ~2 hours of per-minute data

_history: dict[str, deque] = {}  # coin_id -> deque of float


def push(coin_id: str, price: float):
    if coin_id not in _history:
        _history[coin_id] = deque(maxlen=MAX_POINTS)
    _history[coin_id].append(price)


def get_series(coin_id: str) -> pd.Series | None:
    buf = _history.get(coin_id)
    if not buf or len(buf) < 2:
        return None
    return pd.Series(list(buf))


def length(coin_id: str) -> int:
    return len(_history.get(coin_id, []))
