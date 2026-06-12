"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, Activity, Target, Briefcase,
  XCircle, Clock, X, Trophy, AlertTriangle, BarChart2,
  ArrowUpDown, Bitcoin, TrendingUp,
} from "lucide-react";

import { getBackend } from "@/lib/backend";
const BACKEND = getBackend();

// ── Types ─────────────────────────────────────────────────────────────────────

type OpenTrade = {
  id: number; symbol: string; market: string; direction: string;
  entry_price: number; sl_price: number | null; tp_price: number | null;
  size_usd: number; open_time: string;
};

type ClosedTrade = {
  id: number; symbol: string; market: string; direction: string;
  entry_price: number; close_price: number; close_reason: string;
  pnl_usd: number; pnl_pct: number; open_time: string; close_time: string;
  size_usd: number;
};

type Summary = {
  open_trades: number; closed_trades: number; total_pnl_usd: number;
  win_count: number; loss_count: number; win_rate: number | null; equity: number;
};

type Tab       = "crypto" | "forex";
type ResultFilter = "all" | "win" | "loss";
type DateFilter   = "all" | "today" | "7d" | "30d";
type SortMode     = "date_desc" | "date_asc" | "pnl_desc" | "pnl_asc";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(v: number): string {
  if (v >= 10000) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (v >= 100)   return `$${v.toFixed(2)}`;
  if (v >= 1)     return `$${v.toFixed(4)}`;
  return `${v.toFixed(5)}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }) +
    " " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function fmtDuration(open: string, close?: string): string {
  const ms = (close ? new Date(close) : new Date()).getTime() - new Date(open).getTime();
  const h  = Math.floor(ms / 3600000);
  const m  = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h / 24)}g ${h % 24}h`;
  if (h > 0)   return `${h}h ${m}m`;
  return `${m}m`;
}

function shortSym(sym: string) {
  return sym.replace("=X", "").replace("USDT", "").slice(0, 10);
}

function pct(a: number, b: number): number {
  return b === 0 ? 0 : Math.round((a / b) * 100);
}

const REASON_CFG: Record<string, { label: string; color: string; bg: string }> = {
  TP:      { label: "TP",         color: "text-emerald-400", bg: "bg-emerald-500/15" },
  SL:      { label: "SL",         color: "text-red-400",     bg: "bg-red-500/15"     },
  REVERSE: { label: "Inversione", color: "text-amber-400",   bg: "bg-amber-500/15"   },
  SIGNAL:  { label: "Segnale",    color: "text-blue-400",    bg: "bg-blue-500/15"    },
  MANUAL:  { label: "Manuale",    color: "text-slate-400",   bg: "bg-slate-500/15"   },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function FilterBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
        active
          ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
          : "text-slate-500 border-transparent hover:text-slate-300 hover:border-[#1a2e48]"
      }`}
    >
      {children}
    </button>
  );
}

function SlTpRow({ entry, sl, tp }: {
  entry: number; sl: number | null; tp: number | null; direction: string;
}) {
  const slPct = sl ? Math.abs((sl - entry) / entry * 100) : null;
  const tpPct = tp ? Math.abs((tp - entry) / entry * 100) : null;
  return (
    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
      {sl && (
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-sm bg-red-500/60 shrink-0" />
          SL {fmtPrice(sl)}
          {slPct && <span className="text-red-400/80">−{slPct.toFixed(1)}%</span>}
        </span>
      )}
      {tp && (
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-sm bg-emerald-500/60 shrink-0" />
          TP {fmtPrice(tp)}
          {tpPct && <span className="text-emerald-400/80">+{tpPct.toFixed(1)}%</span>}
        </span>
      )}
    </div>
  );
}

function MiniStat({ label, value, sub, color = "text-white" }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-[#070c18]/60 rounded-xl p-3 flex-1 min-w-0">
      <p className="text-[9px] text-slate-600 uppercase tracking-widest font-semibold mb-1">{label}</p>
      <p className={`text-lg font-black tabular-nums leading-none ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-600 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

// ── Market section (reused for crypto + forex) ────────────────────────────────

function MarketSection({
  tab, openTrades, history, loading, closing, onClose,
}: {
  tab: Tab;
  openTrades: OpenTrade[];
  history: ClosedTrade[];
  loading: boolean;
  closing: number | null;
  onClose: (id: number) => void;
}) {
  const [fResult, setFResult] = useState<ResultFilter>("all");
  const [fDate,   setFDate]   = useState<DateFilter>("all");
  const [sort,    setSort]    = useState<SortMode>("date_desc");

  const isCrypto = tab === "crypto";
  const accentBorder = isCrypto ? "border-blue-500/20" : "border-violet-500/20";
  const accentBg     = isCrypto ? "bg-blue-500/5"      : "bg-violet-500/5";

  const filteredHistory = useMemo(() => {
    const now = Date.now();
    let list = history.filter(t => {
      if (fResult === "win"  && t.pnl_usd <= 0) return false;
      if (fResult === "loss" && t.pnl_usd > 0)  return false;
      if (fDate !== "all") {
        const age = now - new Date(t.close_time).getTime();
        if (fDate === "today" && age > 86400000)      return false;
        if (fDate === "7d"    && age > 7 * 86400000)  return false;
        if (fDate === "30d"   && age > 30 * 86400000) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "date_desc") return new Date(b.close_time).getTime() - new Date(a.close_time).getTime();
      if (sort === "date_asc")  return new Date(a.close_time).getTime() - new Date(b.close_time).getTime();
      if (sort === "pnl_desc")  return b.pnl_usd - a.pnl_usd;
      return a.pnl_usd - b.pnl_usd;
    });
    return list;
  }, [history, fResult, fDate, sort]);

  const wins   = filteredHistory.filter(t => t.pnl_usd > 0).length;
  const losses = filteredHistory.filter(t => t.pnl_usd <= 0).length;
  const totalPnl = history.reduce((s, t) => s + t.pnl_usd, 0);
  const winRate  = history.length > 0 ? pct(history.filter(t => t.pnl_usd > 0).length, history.length) : null;
  const best     = history.length > 0 ? history.reduce((m, t) => t.pnl_usd > m.pnl_usd ? t : m, history[0]) : null;

  const sortLabel: Record<SortMode, string> = {
    date_desc: "Data ↓", date_asc: "Data ↑", pnl_desc: "P&L ↓", pnl_asc: "P&L ↑",
  };
  const nextSort: Record<SortMode, SortMode> = {
    date_desc: "date_asc", date_asc: "pnl_desc", pnl_desc: "pnl_asc", pnl_asc: "date_desc",
  };
  const filtersActive = fResult !== "all" || fDate !== "all";

  return (
    <div className="space-y-3">

      {/* Mini stats */}
      {history.length > 0 && (
        <div className="flex gap-2">
          <MiniStat
            label="Win Rate"
            value={winRate != null ? `${winRate}%` : "—"}
            sub={`${history.filter(t => t.pnl_usd > 0).length}W · ${history.filter(t => t.pnl_usd <= 0).length}L`}
            color={winRate == null ? "text-slate-500" : winRate >= 55 ? "text-emerald-400" : winRate >= 45 ? "text-amber-400" : "text-red-400"}
          />
          <MiniStat
            label="P&L"
            value={`${totalPnl >= 0 ? "+" : ""}$${Math.abs(totalPnl).toFixed(2)}`}
            sub={`${history.length} trade chiusi`}
            color={totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}
          />
          {best && (
            <MiniStat
              label="Best"
              value={`+$${best.pnl_usd.toFixed(2)}`}
              sub={shortSym(best.symbol)}
              color="text-emerald-400"
            />
          )}
        </div>
      )}

      {/* Open positions */}
      <div className={`border rounded-xl overflow-hidden ${accentBorder} ${accentBg}`}>
        <div className="px-4 py-2.5 border-b border-[#1a2e48] flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-bold text-white">Posizioni Aperte</span>
          {openTrades.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 font-bold">
              {openTrades.length}
            </span>
          )}
        </div>
        {loading ? (
          <div className="p-3 space-y-2">
            {[1,2].map(i => <div key={i} className="h-14 bg-[#1a2e48] rounded-xl animate-pulse" />)}
          </div>
        ) : openTrades.length === 0 ? (
          <div className="flex items-center justify-center py-8 gap-2">
            <Briefcase size={16} className="text-slate-700" />
            <p className="text-xs text-slate-600">Nessuna posizione aperta</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1a2e48]">
            {openTrades.map(t => {
              const isBuy = t.direction === "BUY";
              return (
                <div key={t.id} className="px-4 py-3 flex items-start gap-3 hover:bg-[#0a1628] transition-colors">
                  <div className={`w-1 mt-1 self-stretch rounded-full shrink-0 min-h-[36px] ${isBuy ? "bg-emerald-500/70" : "bg-red-500/70"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-black text-white">{shortSym(t.symbol)}</span>
                      <span className={`text-xs font-bold ${isBuy ? "text-emerald-400" : "text-red-400"}`}>
                        {isBuy ? "↑ LONG" : "↓ SHORT"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mb-1">
                      <span>Entrata <span className="font-mono text-white">{fmtPrice(t.entry_price)}</span></span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <Clock size={10} />{fmtDuration(t.open_time)}
                      </span>
                    </div>
                    <SlTpRow entry={t.entry_price} sl={t.sl_price} tp={t.tp_price} direction={t.direction} />
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <p className="text-[11px] text-slate-600">${t.size_usd.toLocaleString()}</p>
                    <button
                      onClick={() => onClose(t.id)}
                      disabled={closing === t.id}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border border-red-500/30 text-red-400 hover:border-red-500/60 hover:bg-red-500/10 transition-all disabled:opacity-40"
                    >
                      <X size={9} />{closing === t.id ? "..." : "Chiudi"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* History */}
      <div className="bg-[#0e1b2e] border border-[#1a2e48] rounded-xl overflow-hidden">
        {/* Filters bar */}
        <div className="px-3 py-2 border-b border-[#1a2e48] flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-slate-600 font-semibold mr-1">Storico</span>

          <div className="flex items-center gap-0.5 bg-[#070c18]/60 rounded-lg p-0.5">
            <FilterBtn active={fResult === "all"}  onClick={() => setFResult("all")}>Tutti</FilterBtn>
            <FilterBtn active={fResult === "win"}  onClick={() => setFResult("win")}>
              <span className="text-emerald-400">✓</span> Vinte
            </FilterBtn>
            <FilterBtn active={fResult === "loss"} onClick={() => setFResult("loss")}>
              <span className="text-red-400">✗</span> Perse
            </FilterBtn>
          </div>

          <div className="flex items-center gap-0.5 bg-[#070c18]/60 rounded-lg p-0.5">
            <FilterBtn active={fDate === "all"}   onClick={() => setFDate("all")}>Tutto</FilterBtn>
            <FilterBtn active={fDate === "today"} onClick={() => setFDate("today")}>Oggi</FilterBtn>
            <FilterBtn active={fDate === "7d"}    onClick={() => setFDate("7d")}>7g</FilterBtn>
            <FilterBtn active={fDate === "30d"}   onClick={() => setFDate("30d")}>30g</FilterBtn>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {filtersActive && (
              <button
                onClick={() => { setFResult("all"); setFDate("all"); }}
                className="text-[10px] text-red-400/70 hover:text-red-400 transition-colors"
              >
                Reset
              </button>
            )}
            {filteredHistory.length > 0 && (
              <span className={`text-[11px] font-bold ${filteredHistory.reduce((s,t) => s+t.pnl_usd,0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {filteredHistory.reduce((s,t) => s+t.pnl_usd,0) >= 0 ? "+" : ""}${filteredHistory.reduce((s,t) => s+t.pnl_usd,0).toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* Win/loss bar */}
        {filteredHistory.length > 0 && (
          <div className="px-3 py-1.5 border-b border-[#1a2e48] flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-[#0d1829] overflow-hidden">
              <div className="h-full bg-emerald-500/50 rounded-l-full" style={{ width: `${pct(wins, filteredHistory.length)}%` }} />
            </div>
            <span className="text-[10px] text-slate-500 shrink-0">
              <span className="text-emerald-400 font-bold">{wins}W</span>{" "}
              <span className="text-red-400 font-bold">{losses}L</span>
              <span className="text-slate-600"> ({pct(wins, filteredHistory.length)}%)</span>
            </span>
            <button
              onClick={() => setSort(nextSort[sort])}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-500 border border-[#1a2e48] hover:text-slate-300 transition-all"
            >
              <ArrowUpDown size={9} />{sortLabel[sort]}
            </button>
          </div>
        )}

        {/* Trade list */}
        {loading ? (
          <div className="p-3 space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-12 bg-[#1a2e48] rounded-xl animate-pulse" />)}
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <XCircle size={20} className="text-slate-700" />
            <p className="text-xs text-slate-500">
              {history.length === 0 ? "Nessun trade chiuso" : "Nessun trade con questi filtri"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#0d1829]">
            {filteredHistory.map(t => {
              const won    = t.pnl_usd > 0;
              const isBuy  = t.direction === "BUY";
              const reason = REASON_CFG[t.close_reason] ?? { label: t.close_reason, color: "text-slate-400", bg: "bg-slate-500/15" };
              return (
                <div key={t.id} className={`px-3 py-2.5 flex items-center gap-2.5 transition-colors ${won ? "hover:bg-emerald-500/[0.03]" : "hover:bg-red-500/[0.03]"}`}>
                  <div className={`w-0.5 h-8 rounded-full shrink-0 ${won ? "bg-emerald-500/60" : "bg-red-500/60"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-white">{shortSym(t.symbol)}</span>
                      <span className={`text-[10px] font-semibold ${isBuy ? "text-emerald-400" : "text-red-400"}`}>{isBuy ? "↑" : "↓"}</span>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${reason.bg} ${reason.color}`}>{reason.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-600">
                      <span className="font-mono">{fmtPrice(t.entry_price)} → {fmtPrice(t.close_price)}</span>
                      <span>·</span>
                      <span>{fmtDate(t.close_time)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-black tabular-nums ${won ? "text-emerald-400" : "text-red-400"}`}>
                      {won ? "+" : ""}${t.pnl_usd.toFixed(2)}
                    </p>
                    <p className={`text-[10px] ${won ? "text-emerald-400/70" : "text-red-400/70"}`}>
                      {t.pnl_pct >= 0 ? "+" : ""}{t.pnl_pct.toFixed(2)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const [summary,    setSummary]    = useState<Summary | null>(null);
  const [open,       setOpen]       = useState<OpenTrade[]>([]);
  const [history,    setHistory]    = useState<ClosedTrade[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [closing,    setClosing]    = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab,        setTab]        = useState<Tab>("crypto");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [port, hist] = await Promise.all([
        fetch(`${BACKEND}/api/portfolio`).then(r => r.json()).catch(() => null),
        fetch(`${BACKEND}/api/portfolio/history?limit=500`).then(r => r.json()).catch(() => []),
      ]);
      if (port) { setSummary(port.summary); setOpen(port.open ?? []); }
      setHistory(Array.isArray(hist) ? hist : []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetch(`${BACKEND}/api/portfolio/refresh`, { method: "POST" });
      await fetchAll();
    } finally { setRefreshing(false); }
  }

  async function handleClose(tradeId: number) {
    if (!confirm("Chiudere questa posizione al prezzo attuale?")) return;
    setClosing(tradeId);
    try {
      const r = await fetch(`${BACKEND}/api/portfolio/close/${tradeId}`, { method: "POST" });
      if (!r.ok) { const e = await r.json(); alert(e.detail || "Errore"); return; }
      await fetchAll();
    } finally { setClosing(null); }
  }

  const cryptoOpen    = open.filter(t => t.market === "crypto");
  const forexOpen     = open.filter(t => t.market === "forex");
  const cryptoHistory = history.filter(t => t.market === "crypto");
  const forexHistory  = history.filter(t => t.market === "forex");

  const equity   = summary?.equity ?? 10000;
  const totalPnl = summary?.total_pnl_usd ?? 0;
  const pnlPct   = (equity - 10000) / 10000 * 100;

  return (
    <div className="h-full bg-[#070c18] text-white flex flex-col">

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#1a2e48] bg-[#070c18]/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-[#111d30] border border-[#1a2e48] transition-all">
            <ArrowLeft size={13} /> Dashboard
          </Link>
          <div>
            <h1 className="text-sm font-bold text-white leading-none">Paper Portfolio</h1>
            <p className="text-xs text-slate-500 mt-0.5">Simulazione · $1.000 per posizione</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#1a2e48] text-slate-300 bg-[#0d1829] hover:border-blue-500/40 hover:text-white transition-all disabled:opacity-50"
        >
          <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          <span className="hidden sm:inline">Controlla SL/TP</span>
        </button>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4 max-w-5xl mx-auto w-full space-y-4 pb-20 md:pb-6">

        {/* ── Hero equity ── */}
        <div className={`rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${
          pnlPct >= 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"
        }`}>
          <div className="flex-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1">Capitale simulato</p>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className={`text-3xl sm:text-4xl font-black tabular-nums ${pnlPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                ${equity.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </span>
              <span className={`text-base font-bold ${pnlPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
              </span>
              <span className="text-sm text-slate-500">({totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)})</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-[#1a2e48] overflow-hidden w-full max-w-xs">
              <div
                className={`h-full rounded-full ${pnlPct >= 0 ? "bg-emerald-500/70" : "bg-red-500/70"}`}
                style={{ width: `${Math.min(Math.abs(pnlPct) * 5, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-600 mt-1">Capitale iniziale $10.000</p>
          </div>
          <div className="flex sm:flex-col gap-5 sm:gap-2 sm:text-right shrink-0">
            <div>
              <p className="text-[9px] text-slate-600 uppercase tracking-wide">Trade chiusi</p>
              <p className="text-xl font-bold text-white">{summary?.closed_trades ?? 0}</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-600 uppercase tracking-wide">Posizioni aperte</p>
              <p className={`text-xl font-bold ${(summary?.open_trades ?? 0) > 0 ? "text-amber-400" : "text-slate-400"}`}>
                {summary?.open_trades ?? 0}
              </p>
            </div>
          </div>
        </div>

        {/* ── Tab switcher ── */}
        <div className="flex gap-1 bg-[#0e1b2e] border border-[#1a2e48] p-1 rounded-xl">
          <button
            onClick={() => setTab("crypto")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === "crypto"
                ? "bg-blue-600/90 text-white shadow-[0_0_12px_rgba(59,130,246,.25)]"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Bitcoin size={13} />
            Crypto
            {cryptoOpen.length > 0 && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${tab === "crypto" ? "bg-white/20 text-white" : "bg-amber-500/20 text-amber-400"}`}>
                {cryptoOpen.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("forex")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
              tab === "forex"
                ? "bg-violet-600/90 text-white shadow-[0_0_12px_rgba(139,92,246,.25)]"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <TrendingUp size={13} />
            Forex
            {forexOpen.length > 0 && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${tab === "forex" ? "bg-white/20 text-white" : "bg-amber-500/20 text-amber-400"}`}>
                {forexOpen.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Tab content ── */}
        <MarketSection
          key={tab}
          tab={tab}
          openTrades={tab === "crypto" ? cryptoOpen : forexOpen}
          history={tab === "crypto" ? cryptoHistory : forexHistory}
          loading={loading}
          closing={closing}
          onClose={handleClose}
        />

        {/* Disclaimer */}
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
          <AlertTriangle size={12} className="text-amber-400 shrink-0" />
          <p className="text-xs text-amber-200/60">
            Simulazione. Nessun denaro reale viene investito. I risultati passati non garantiscono quelli futuri.
          </p>
        </div>

      </div>
    </div>
  );
}
