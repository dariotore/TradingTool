"""
Persistent signal store (SQLite).

Every BUY/SELL recommendation is saved with its market context.
After 4h and 24h the outcome checker records whether the direction
was correct. Accuracy statistics feed back into synthesis.py as a
confidence multiplier — the system learns from its own track record.
"""
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "signals.db"


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH, check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c


def init_db() -> None:
    with _conn() as c:
        c.executescript("""
            CREATE TABLE IF NOT EXISTS signals (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp        TEXT    NOT NULL,
                symbol           TEXT    NOT NULL,
                yahoo_symbol     TEXT    NOT NULL,
                market           TEXT    NOT NULL,
                action           TEXT    NOT NULL,
                confidence       REAL,
                weighted_score   REAL,
                price_at_signal  REAL,
                stop_loss        REAL,
                take_profit      REAL,
                regime           TEXT,
                mtf_trend        TEXT,
                divergence       TEXT,
                candle_signal    TEXT,
                indicators_json  TEXT
            );
            CREATE TABLE IF NOT EXISTS outcomes (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                signal_id         INTEGER NOT NULL,
                check_period      TEXT    NOT NULL,
                checked_at        TEXT    NOT NULL,
                price_at_check    REAL,
                price_change_pct  REAL,
                direction_correct INTEGER,
                UNIQUE(signal_id, check_period),
                FOREIGN KEY (signal_id) REFERENCES signals(id)
            );
            CREATE INDEX IF NOT EXISTS idx_sig_symbol    ON signals(symbol);
            CREATE INDEX IF NOT EXISTS idx_sig_timestamp ON signals(timestamp);
        """)
        # Migrate existing DBs that pre-date the SL/TP columns
        for col, typ in [("stop_loss", "REAL"), ("take_profit", "REAL")]:
            try:
                c.execute(f"ALTER TABLE signals ADD COLUMN {col} {typ}")
            except Exception:
                pass   # column already exists


# ── Write ────────────────────────────────────────────────────────────────────

def save_signal(symbol: str, yahoo_symbol: str, market: str,
                synth: dict, tech_details: dict, price: float | None) -> int:
    """
    Persist a tradeable signal. Returns the row id or -1 if skipped.
    Skips HOLD/AVOID, zero-price entries, and duplicates within 30 min.
    """
    action = synth.get("recommendation", "HOLD")
    if action in ("HOLD", "AVOID"):
        return -1
    if not price or price == 0:
        return -1

    with _conn() as c:
        # Dedup: same symbol+action within 30 minutes → skip
        dup = c.execute("""
            SELECT id FROM signals
            WHERE symbol = ? AND action = ?
              AND datetime(timestamp) >= datetime('now', '-30 minutes')
            LIMIT 1
        """, (symbol, action)).fetchone()
        if dup:
            return -1

        adx    = float(tech_details.get("adx") or 20.0)
        regime = "trending" if adx > 25 else ("ranging" if adx < 20 else "transitional")

        rd = synth.get("risk_details") or {}
        sl = rd.get("suggested_stop_loss")
        tp = rd.get("suggested_take_profit")

        cur = c.execute("""
            INSERT INTO signals
            (timestamp, symbol, yahoo_symbol, market, action, confidence,
             weighted_score, price_at_signal, stop_loss, take_profit,
             regime, mtf_trend, divergence, candle_signal, indicators_json)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            datetime.now(timezone.utc).isoformat(),
            symbol, yahoo_symbol, market, action,
            synth.get("confidence"),
            synth.get("weighted_score"),
            price, sl, tp, regime,
            tech_details.get("mtf_trend", "neutral"),
            tech_details.get("divergence", "none"),
            tech_details.get("candle_signal", "neutral"),
            json.dumps(tech_details),
        ))
        return cur.lastrowid


def save_outcome(signal_id: int, period: str, price_at_check: float,
                 price_at_signal: float, action: str) -> None:
    if price_at_signal == 0:
        return
    pct = (price_at_check - price_at_signal) / price_at_signal * 100
    thr = 0.3   # minimum % move to count as directionally correct
    if action in ("BUY", "STRONG_BUY"):
        correct = 1 if pct > thr else (0 if pct < -thr else None)
    else:
        correct = 1 if pct < -thr else (0 if pct > thr else None)

    with _conn() as c:
        c.execute("""
            INSERT OR IGNORE INTO outcomes
            (signal_id, check_period, checked_at,
             price_at_check, price_change_pct, direction_correct)
            VALUES (?,?,?,?,?,?)
        """, (signal_id, period,
              datetime.now(timezone.utc).isoformat(),
              price_at_check, round(pct, 4), correct))


# ── Read ─────────────────────────────────────────────────────────────────────

def get_pending_checks() -> list[dict]:
    """Signals that have reached their 4h or 24h checkpoint without an outcome."""
    with _conn() as c:
        rows = c.execute("""
            SELECT id, symbol, yahoo_symbol, market,
                   action, price_at_signal, timestamp
            FROM signals
            WHERE action IN ('BUY','SELL','STRONG_BUY','STRONG_SELL')
              AND datetime(timestamp) <= datetime('now', '-4 hours')
            ORDER BY timestamp DESC
            LIMIT 300
        """).fetchall()

        result = []
        for r in rows:
            done = {
                p["check_period"]
                for p in c.execute(
                    "SELECT check_period FROM outcomes WHERE signal_id = ?", (r["id"],)
                ).fetchall()
            }
            sig_time = datetime.fromisoformat(r["timestamp"])
            age_h    = (datetime.now(timezone.utc) - sig_time).total_seconds() / 3600
            needed   = []
            if age_h >= 4  and "4h"  not in done: needed.append("4h")
            if age_h >= 24 and "24h" not in done: needed.append("24h")
            if needed:
                result.append({**dict(r), "needed_periods": needed})
        return result


def get_accuracy_stats(symbol: str | None = None, regime: str | None = None,
                       period: str = "24h", min_samples: int = 10) -> dict:
    where  = ["o.check_period = ?", "o.direction_correct IS NOT NULL"]
    params: list = [period]
    if symbol: where.append("s.symbol = ?");  params.append(symbol)
    if regime: where.append("s.regime = ?");  params.append(regime)

    with _conn() as c:
        row = c.execute(f"""
            SELECT COUNT(*) as total, SUM(o.direction_correct) as correct
            FROM outcomes o JOIN signals s ON s.id = o.signal_id
            WHERE {' AND '.join(where)}
        """, params).fetchone()

    total   = row["total"]   or 0
    correct = int(row["correct"] or 0)
    if total < min_samples:
        return {"total": total, "correct": correct, "accuracy": None, "sufficient": False}
    return {"total": total, "correct": correct,
            "accuracy": round(correct / total, 3), "sufficient": True}


def get_confidence_multiplier(symbol: str, regime: str) -> float:
    """
    Returns a learning-based multiplier (0.70–1.20).
    Tries symbol+regime first, falls back to symbol-only, then returns 1.0 if no data.
    """
    for stats in (
        get_accuracy_stats(symbol=symbol, regime=regime),
        get_accuracy_stats(symbol=symbol),
    ):
        if stats["sufficient"]:
            acc = stats["accuracy"]
            if   acc < 0.40: return 0.70
            elif acc < 0.50: return 0.85
            elif acc < 0.60: return 1.00
            elif acc < 0.70: return 1.10
            else:            return 1.20
    return 1.0


def get_recent_signal_summary(symbol: str, n: int = 20) -> str | None:
    """Italian summary of recent signal accuracy passed to Claude as context."""
    with _conn() as c:
        rows = c.execute("""
            SELECT s.action, s.regime,
                   o24.direction_correct AS c24
            FROM signals s
            LEFT JOIN outcomes o24
                   ON o24.signal_id = s.id AND o24.check_period = '24h'
            WHERE s.symbol = ?
            ORDER BY s.timestamp DESC LIMIT ?
        """, (symbol, n)).fetchall()

    if not rows:
        return None

    evaluated = [r for r in rows if r["c24"] is not None]
    if len(evaluated) < 3:
        return f"Storico {symbol}: {len(rows)} segnali, {len(evaluated)} con outcome disponibile."

    correct = sum(1 for r in evaluated if r["c24"] == 1)
    acc     = round(correct / len(evaluated) * 100)

    by_regime: dict[str, dict] = {}
    for r in evaluated:
        s = by_regime.setdefault(r["regime"] or "unknown", {"ok": 0, "tot": 0})
        s["tot"] += 1
        if r["c24"] == 1: s["ok"] += 1

    parts = [f"Storico segnali {symbol}: {correct}/{len(evaluated)} corretti = {acc}% accuracy (24h)."]
    regime_txt = [
        f"{rg}: {round(v['ok']/v['tot']*100)}% ({v['tot']})"
        for rg, v in by_regime.items() if v["tot"] >= 3
    ]
    if regime_txt:
        parts.append("Per regime — " + ", ".join(regime_txt) + ".")
    return " ".join(parts)


def get_recent_signals(limit: int = 200, market: str | None = None,
                        action: str | None = None) -> list[dict]:
    """Return recent signals with their 4h/24h outcomes for the history dashboard."""
    where:  list[str] = []
    params: list      = []
    if market: where.append("s.market = ?");  params.append(market)
    if action: where.append("s.action = ?");  params.append(action)
    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    params.append(limit)

    with _conn() as c:
        rows = c.execute(f"""
            SELECT s.id, s.timestamp, s.symbol, s.market, s.action,
                   s.confidence, s.weighted_score, s.price_at_signal,
                   s.stop_loss, s.take_profit,
                   s.regime, s.mtf_trend, s.divergence, s.candle_signal,
                   o4.price_change_pct  AS pct_4h,
                   o4.direction_correct AS ok_4h,
                   o24.price_change_pct AS pct_24h,
                   o24.direction_correct AS ok_24h
            FROM signals s
            LEFT JOIN outcomes o4
                   ON o4.signal_id  = s.id AND o4.check_period  = '4h'
            LEFT JOIN outcomes o24
                   ON o24.signal_id = s.id AND o24.check_period = '24h'
            {where_sql}
            ORDER BY s.timestamp DESC
            LIMIT ?
        """, params).fetchall()
    return [dict(r) for r in rows]


def get_all_stats() -> list[dict]:
    """Global accuracy table for the /api/accuracy endpoint."""
    with _conn() as c:
        rows = c.execute("""
            SELECT s.symbol, s.market, s.regime,
                   COUNT(*)                  AS total,
                   SUM(o.direction_correct)  AS correct
            FROM outcomes o
            JOIN signals s ON s.id = o.signal_id
            WHERE o.check_period = '24h' AND o.direction_correct IS NOT NULL
            GROUP BY s.symbol, s.regime
            HAVING total >= 5
            ORDER BY s.market, s.symbol
        """).fetchall()
    return [
        {**dict(r), "accuracy": round(int(r["correct"] or 0) / r["total"], 3)}
        for r in rows
    ]


def get_chart_data(market: str) -> list[dict]:
    """Per-symbol signal vs outcome counts for the history chart panel."""
    with _conn() as c:
        rows = c.execute("""
            SELECT
                s.symbol,
                COUNT(DISTINCT s.id) AS total,
                SUM(CASE WHEN o24.direction_correct = 1 THEN 1 ELSE 0 END) AS correct,
                SUM(CASE WHEN o24.direction_correct = 0 THEN 1 ELSE 0 END) AS wrong
            FROM signals s
            LEFT JOIN outcomes o24
                   ON o24.signal_id = s.id AND o24.check_period = '24h'
            WHERE s.market = ?
            GROUP BY s.symbol
            ORDER BY total DESC
        """, (market,)).fetchall()
    result = []
    for r in rows:
        correct = int(r["correct"] or 0)
        wrong   = int(r["wrong"]   or 0)
        total   = int(r["total"]   or 0)
        eval_   = correct + wrong
        result.append({
            "symbol":   r["symbol"],
            "total":    total,
            "correct":  correct,
            "wrong":    wrong,
            "pending":  total - eval_,
            "accuracy": round(correct / eval_ * 100, 1) if eval_ > 0 else None,
        })
    return result


def get_backtest_summary(market: str | None = None) -> dict:
    """
    Simulated P&L using recorded signal outcomes (24h window).
    Starting equity: $10,000 — 2% position size per trade.
    Returns overall metrics, equity curve (last 200 trades), per-symbol breakdown.
    """
    import statistics
    import math

    where  = ["o.direction_correct IS NOT NULL", "o.check_period = '24h'"]
    params: list = []
    if market:
        where.append("s.market = ?")
        params.append(market)

    with _conn() as c:
        rows = c.execute(f"""
            SELECT s.symbol, s.market, s.action, s.price_at_signal,
                   s.stop_loss, s.take_profit, s.timestamp,
                   o.price_change_pct, o.direction_correct
            FROM outcomes o
            JOIN signals s ON s.id = o.signal_id
            WHERE {' AND '.join(where)}
            ORDER BY s.timestamp ASC
        """, params).fetchall()

    if not rows:
        return {"total_trades": 0, "message": "Nessun segnale con outcome disponibile."}

    equity       = 10_000.0
    equity_curve = []
    returns_pct  = []
    wins_pnl     = []
    losses_pnl   = []
    by_symbol: dict[str, dict] = {}

    for r in rows:
        action   = r["action"]
        pct_raw  = float(r["price_change_pct"] or 0)
        correct  = r["direction_correct"]

        # Directional return for this signal
        trade_ret = pct_raw if action in ("BUY", "STRONG_BUY") else -pct_raw

        position = equity * 0.02
        pnl      = position * (trade_ret / 100.0)
        equity   = max(equity + pnl, 0.01)   # floor at 1 cent

        returns_pct.append(trade_ret)
        equity_curve.append({"ts": r["timestamp"], "equity": round(equity, 2)})

        if pnl > 0:   wins_pnl.append(pnl)
        elif pnl < 0: losses_pnl.append(pnl)

        sym = r["symbol"]
        if sym not in by_symbol:
            by_symbol[sym] = {"trades": 0, "wins": 0, "total_return_pct": 0.0, "market": r["market"]}
        by_symbol[sym]["trades"] += 1
        if correct == 1:
            by_symbol[sym]["wins"] += 1
        by_symbol[sym]["total_return_pct"] += trade_ret

    total   = len(rows)
    w_count = len(wins_pnl)
    l_count = len(losses_pnl)

    # Max drawdown on equity curve
    peak   = 10_000.0
    max_dd = 0.0
    for pt in equity_curve:
        if pt["equity"] > peak:
            peak = pt["equity"]
        dd = (peak - pt["equity"]) / peak
        if dd > max_dd:
            max_dd = dd

    # Simplified annualised Sharpe (per-trade, assuming ~250 trades/year)
    sharpe = 0.0
    if len(returns_pct) > 1:
        mu  = statistics.mean(returns_pct)
        sig = statistics.stdev(returns_pct)
        if sig > 0:
            sharpe = round(mu / sig * math.sqrt(250), 2)

    total_won  = sum(wins_pnl)
    total_lost = abs(sum(losses_pnl)) if losses_pnl else 0
    avg_win    = round(total_won  / w_count, 2) if w_count else 0
    avg_loss   = round(total_lost / l_count, 2) if l_count else 0

    sym_summary = sorted(
        [
            {
                "symbol":            sym,
                "market":            d["market"],
                "trades":            d["trades"],
                "wins":              d["wins"],
                "win_rate":          round(d["wins"] / d["trades"] * 100, 1) if d["trades"] else 0,
                "total_return_pct":  round(d["total_return_pct"], 2),
            }
            for sym, d in by_symbol.items()
        ],
        key=lambda x: -x["trades"],
    )

    return {
        "total_trades":      total,
        "win_count":         w_count,
        "loss_count":        l_count,
        "win_rate_pct":      round(w_count / total * 100, 1) if total else 0,
        "profit_factor":     round(total_won / total_lost, 2) if total_lost > 0 else None,
        "avg_win_usd":       avg_win,
        "avg_loss_usd":      avg_loss,
        "total_return_pct":  round((equity - 10_000) / 10_000 * 100, 2),
        "sharpe_ratio":      sharpe,
        "max_drawdown_pct":  round(max_dd * 100, 2),
        "starting_equity":   10_000,
        "final_equity":      round(equity, 2),
        "equity_curve":      equity_curve[-200:],
        "by_symbol":         sym_summary,
    }


def cleanup_incomplete_signals() -> int:
    """Delete signals without SL/TP (pre-tracking records) and their outcomes."""
    with _conn() as c:
        c.execute("""
            DELETE FROM outcomes WHERE signal_id IN (
                SELECT id FROM signals
                WHERE stop_loss IS NULL OR take_profit IS NULL
            )
        """)
        cur = c.execute("""
            DELETE FROM signals WHERE stop_loss IS NULL OR take_profit IS NULL
        """)
        return cur.rowcount
