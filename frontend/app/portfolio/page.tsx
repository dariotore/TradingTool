"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, TrendingUp, TrendingDown,
  DollarSign, Activity, Target, Briefcase,
  XCircle, Clock, X, Trophy,
  AlertTriangle, BarChart2, ChevronDown, ArrowUpDown,
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

type MarketFilter = "all" | "crypto" | "forex";
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
  TP:      { label: "Take Profit", color: "text-emerald-400", bg: "bg-emerald-500/15" },
  SL:      { label: "Stop Loss",   color: "text-red-400",     bg: "bg-red-500/15"     },
  REVERSE: { label: "Inversione",  color: "text-amber-400",   bg: "bg-amber-500/15"   },
  SIGNAL:  { label: "Segnale",     color: "text-blue-400",    bg: "bg-blue-500/15"    },
  MANUAL:  { label: "Manuale",     color: "text-slate-400",   bg: "bg-slate-500/15"   },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function MarketTag({ market }: { market: string }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
      market === "crypto"
        ? "bg-blue-500/15 text-blue-400"
        : "bg-violet-500/15 text-violet-400"
    }`}>{market === "crypto" ? "Crypto" : "Forex"}</span>
  );
}

function FilterChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
        active
          ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
          : "text-slate-500 border-[#1a2e48] hover:text-slate-300 hover:border-slate-600"
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

function StatCard({
  label, icon, children,
}: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-[#0e1b2e] border border-[#1a2e48] rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-500 font-semibold uppercase tracking-wide">{label}</span>
        <span className="text-slate-600">{icon}</span>
      </div>
      {children}
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
  const [fMarket,    setFMarket]    = useState<MarketFilter>("all");
  const [fResult,    setFResult]    = useState<ResultFilter>("all");
  const [fDate,      setFDate]      = useState<DateFilter>("all");
  const [sortMode,   setSortMode]   = useState<SortMode>("date_desc");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [port, hist] = await Promise.all([
        fetch(`${BACKEND}/api/portfolio`).then(r => r.json()).catch(() => null),
        fetch(`${BACKEND}/api/portfolio/history?limit=200`).then(r => r.json()).catch(() => []),
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

  const filteredHistory = useMemo(() => {
    const now = Date.now();
    let list = history.filter(t => {
      if (fMarket !== "all" && t.market !== fMarket) return false;
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
      if (sortMode === "date_desc") return new Date(b.close_time).getTime() - new Date(a.close_time).getTime();
      if (sortMode === "date_asc")  return new Date(a.close_time).getTime() - new Date(b.close_time).getTime();
      if (sortMode === "pnl_desc")  return b.pnl_usd - a.pnl_usd;
      if (sortMode === "pnl_asc")   return a.pnl_usd - b.pnl_usd;
      return 0;
    });

    return list;
  }, [history, fMarket, fResult, fDate, sortMode]);

  const stats = useMemo(() => {
    if (history.length === 0) return null;
    const wins   = history.filter(t => t.pnl_usd > 0);
    const losses = history.filter(t => t.pnl_usd <= 0);
    const totalWin  = wins.reduce((s, t) => s + t.pnl_usd, 0);
    const totalLoss = Math.abs(losses.reduce((s, t) => s + t.pnl_usd, 0));
    return {
      profitFactor: totalLoss > 0 ? totalWin / totalLoss : wins.length > 0 ? 999 : 0,
      avgWin:  wins.length   > 0 ? totalWin  / wins.length   : 0,
      avgLoss: losses.length > 0 ? totalLoss / losses.length : 0,
      best:    history.reduce((m, t) => t.pnl_usd > m.pnl_usd ? t : m, history[0]),
    };
  }, [history]);

  const equity   = summary?.equity ?? 10000;
  const totalPnl = summary?.total_pnl_usd ?? 0;
  const pnlPct   = (equity - 10000) / 10000 * 100;
  const winRate  = summary?.win_rate ?? null;
  const filtersActive = fMarket !== "all" || fResult !== "all" || fDate !== "all";
  const filteredWins   = filteredHistory.filter(t => t.pnl_usd > 0).length;
  const filteredLosses = filteredHistory.filter(t => t.pnl_usd <= 0).length;
  const filteredPnl    = filteredHistory.reduce((s, t) => s + t.pnl_usd, 0);

  function resetFilters() { setFMarket("all"); setFResult("all"); setFDate("all"); }

  function cycleSortMode() {
    const next: Record<SortMode, SortMode> = {
      date_desc: "date_asc",
      date_asc:  "pnl_desc",
      pnl_desc:  "pnl_asc",
      pnl_asc:   "date_desc",
    };
    setSortMode(prev => next[prev]);
  }

  const sortLabel: Record<SortMode, string> = {
    date_desc: "Data ↓",
    date_asc:  "Data ↑",
    pnl_desc:  "P&L ↓",
    pnl_asc:   "P&L ↑",
  };

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
          Controlla SL/TP
        </button>
      </header>

      <div className="flex-1 overflow-auto px-4 py-5 max-w-5xl mx-auto w-full flex flex-col gap-5 pb-20 md:pb-6">

        {/* ── Hero equity ── */}
        <div className={`rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${
          pnlPct >= 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"
        }`}>
          <div className="flex-1">
            <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-1">Capitale simulato</p>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className={`text-4xl font-black tabular-nums ${pnlPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                ${equity.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </span>
              <span className={`text-lg font-bold ${pnlPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
              </span>
              <span className="text-sm text-slate-500">
                ({totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)})
              </span>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-[#1a2e48] overflow-hidden w-full max-w-xs">
              <div
                className={`h-full rounded-full transition-all ${pnlPct >= 0 ? "bg-emerald-500/70" : "bg-red-500/70"}`}
                style={{ width: `${Math.min(Math.abs(pnlPct) * 5, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-600 mt-1">Capitale iniziale $10.000</p>
          </div>

          <div className="flex sm:flex-col gap-6 sm:gap-2 sm:text-right shrink-0">
            <div>
              <p className="text-[10px] text-slate-600 uppercase tracking-wide">Trade chiusi</p>
              <p className="text-2xl font-bold text-white">{summary?.closed_trades ?? 0}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-600 uppercase tracking-wide">Posizioni aperte</p>
              <p className={`text-2xl font-bold ${(summary?.open_trades ?? 0) > 0 ? "text-amber-400" : "text-slate-400"}`}>
                {summary?.open_trades ?? 0}
              </p>
            </div>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

          <StatCard label="Win Rate" icon={<Target size={14} />}>
            <p className={`text-2xl font-black ${
              winRate == null ? "text-slate-500" :
              winRate >= 60 ? "text-emerald-400" :
              winRate >= 50 ? "text-amber-400" : "text-red-400"
            }`}>{winRate != null ? `${winRate}%` : "—"}</p>
            {summary && summary.closed_trades > 0 && (
              <>
                <div className="mt-2 h-1.5 rounded-full bg-[#0d1829] overflow-hidden">
                  <div
                    className="h-full bg-emerald-500/60 rounded-full"
                    style={{ width: `${pct(summary.win_count, summary.closed_trades)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  <span className="text-emerald-400 font-semibold">{summary.win_count}</span> vinte ·{" "}
                  <span className="text-red-400 font-semibold">{summary.loss_count}</span> perse
                </p>
              </>
            )}
          </StatCard>

          <StatCard label="P&L Totale" icon={<Activity size={14} />}>
            <p className={`text-2xl font-black ${totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {totalPnl >= 0 ? "+" : ""}${Math.abs(totalPnl).toFixed(2)}
            </p>
            {stats && (
              <p className="text-[11px] text-slate-500 mt-2">
                Guad.{" "}<span className="text-emerald-400 font-semibold">+${stats.avgWin.toFixed(2)}</span>
                {" "}· Perd.{" "}<span className="text-red-400 font-semibold">−${stats.avgLoss.toFixed(2)}</span>
              </p>
            )}
          </StatCard>

          <StatCard label="Profit Factor" icon={<BarChart2 size={14} />}>
            <p className={`text-2xl font-black ${
              !stats ? "text-slate-500" :
              stats.profitFactor >= 1.5 ? "text-emerald-400" :
              stats.profitFactor >= 1   ? "text-amber-400" : "text-red-400"
            }`}>{stats ? (stats.profitFactor >= 100 ? "∞" : stats.profitFactor.toFixed(2)) : "—"}</p>
            <p className="text-[11px] text-slate-500 mt-2">
              {!stats ? "nessun trade" :
               stats.profitFactor >= 1.5 ? "strategia redditizia" :
               stats.profitFactor >= 1   ? "in pareggio" : "in perdita"}
            </p>
          </StatCard>

          <StatCard label="Miglior trade" icon={<Trophy size={14} />}>
            <p className="text-2xl font-black text-emerald-400">
              {stats ? `+$${stats.best.pnl_usd.toFixed(2)}` : "—"}
            </p>
            {stats && (
              <p className="text-[11px] text-slate-500 mt-2">
                {shortSym(stats.best.symbol)} · {fmtDate(stats.best.close_time)}
              </p>
            )}
          </StatCard>
        </div>

        {/* ── Open positions ── */}
        <div className="bg-[#0e1b2e] border border-[#1a2e48] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1a2e48] flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span className="text-sm font-bold text-white">Posizioni Aperte</span>
            {open.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 font-bold">
                {open.length}
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-4 space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-[#1a2e48] rounded-xl animate-pulse" />)}
            </div>
          ) : open.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Briefcase size={24} className="text-slate-700" />
              <p className="text-sm text-slate-500 font-medium">Nessuna posizione aperta</p>
              <p className="text-xs text-slate-600">Le posizioni si aprono automaticamente sui segnali</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1a2e48]">
              {open.map(t => {
                const isBuy = t.direction === "BUY";
                return (
                  <div key={t.id} className="px-4 py-3.5 flex items-start gap-3 hover:bg-[#0a1628] transition-colors">

                    {/* Direction bar */}
                    <div className={`w-1 mt-1 self-stretch rounded-full shrink-0 min-h-[40px] ${isBuy ? "bg-emerald-500/70" : "bg-red-500/70"}`} />

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-base font-black text-white">{shortSym(t.symbol)}</span>
                        <MarketTag market={t.market} />
                        <span className={`text-xs font-bold ${isBuy ? "text-emerald-400" : "text-red-400"}`}>
                          {isBuy ? "↑ LONG" : "↓ SHORT"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mb-1">
                        <span>Entrata <span className="font-mono text-white">{fmtPrice(t.entry_price)}</span></span>
                        <span className="text-slate-600">·</span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Clock size={10} />
                          {fmtDuration(t.open_time)}
                        </span>
                      </div>
                      <SlTpRow entry={t.entry_price} sl={t.sl_price} tp={t.tp_price} direction={t.direction} />
                    </div>

                    {/* Size + close */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <p className="text-xs text-slate-600">${t.size_usd.toLocaleString()}</p>
                      <button
                        onClick={() => handleClose(t.id)}
                        disabled={closing === t.id}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-red-500/30 text-red-400 hover:border-red-500/60 hover:bg-red-500/10 transition-all disabled:opacity-40"
                      >
                        <X size={10} />
                        {closing === t.id ? "..." : "Chiudi"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Storico ── */}
        <div className="bg-[#0e1b2e] border border-[#1a2e48] rounded-xl overflow-hidden">

          {/* Header + filtri */}
          <div className="px-4 pt-3 pb-3 border-b border-[#1a2e48]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-white">Storico Trade</span>
              <div className="flex items-center gap-2">
                {/* P&L filtrato */}
                {filteredHistory.length > 0 && (
                  <span className={`text-xs font-bold ${filteredPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {filteredPnl >= 0 ? "+" : ""}${filteredPnl.toFixed(2)}
                  </span>
                )}
                <span className="text-xs text-slate-500">
                  {filteredHistory.length}{filteredHistory.length !== history.length && ` / ${history.length}`}
                </span>
                {filtersActive && (
                  <button onClick={resetFilters} className="text-[11px] text-red-400 hover:text-red-300 underline">
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Filtri */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-slate-600 uppercase tracking-widest w-12 shrink-0">Mercato</span>
                <FilterChip active={fMarket === "all"}    onClick={() => setFMarket("all")}>Tutti</FilterChip>
                <FilterChip active={fMarket === "crypto"} onClick={() => setFMarket("crypto")}>Crypto</FilterChip>
                <FilterChip active={fMarket === "forex"}  onClick={() => setFMarket("forex")}>Forex</FilterChip>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-slate-600 uppercase tracking-widest w-12 shrink-0">Esito</span>
                <FilterChip active={fResult === "all"}  onClick={() => setFResult("all")}>Tutti</FilterChip>
                <FilterChip active={fResult === "win"}  onClick={() => setFResult("win")}>
                  <span className="text-emerald-400">✓</span>&nbsp;Vinte
                </FilterChip>
                <FilterChip active={fResult === "loss"} onClick={() => setFResult("loss")}>
                  <span className="text-red-400">✗</span>&nbsp;Perse
                </FilterChip>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-slate-600 uppercase tracking-widest w-12 shrink-0">Periodo</span>
                <FilterChip active={fDate === "all"}   onClick={() => setFDate("all")}>Tutto</FilterChip>
                <FilterChip active={fDate === "today"} onClick={() => setFDate("today")}>Oggi</FilterChip>
                <FilterChip active={fDate === "7d"}    onClick={() => setFDate("7d")}>7 giorni</FilterChip>
                <FilterChip active={fDate === "30d"}   onClick={() => setFDate("30d")}>30 giorni</FilterChip>
              </div>
            </div>
          </div>

          {/* Win/loss bar + sort */}
          {filteredHistory.length > 0 && (
            <div className="px-4 py-2 border-b border-[#1a2e48] flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full bg-[#0d1829] overflow-hidden">
                <div
                  className="h-full bg-emerald-500/50 rounded-l-full"
                  style={{ width: `${pct(filteredWins, filteredHistory.length)}%` }}
                />
              </div>
              <span className="text-xs text-slate-500 shrink-0">
                <span className="text-emerald-400 font-bold">{filteredWins}W</span>{" "}
                <span className="text-red-400 font-bold">{filteredLosses}L</span>
                <span className="text-slate-600 ml-1">({pct(filteredWins, filteredHistory.length)}%)</span>
              </span>
              <button
                onClick={cycleSortMode}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-slate-400 border border-[#1a2e48] hover:border-slate-600 hover:text-slate-200 transition-all shrink-0"
              >
                <ArrowUpDown size={10} />
                {sortLabel[sortMode]}
              </button>
            </div>
          )}

          {/* Lista trade */}
          {loading ? (
            <div className="p-4 space-y-2">
              {[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-[#1a2e48] rounded-xl animate-pulse" />)}
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <XCircle size={24} className="text-slate-700" />
              <p className="text-sm text-slate-500 font-medium">
                {history.length === 0 ? "Nessun trade chiuso ancora" : "Nessun trade con questi filtri"}
              </p>
              {filtersActive && (
                <button onClick={resetFilters} className="text-xs text-blue-400 hover:text-blue-300 underline mt-1">
                  Rimuovi filtri
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-[#0d1829]">
              {filteredHistory.map(t => {
                const won    = t.pnl_usd > 0;
                const isBuy  = t.direction === "BUY";
                const reason = REASON_CFG[t.close_reason] ?? { label: t.close_reason, color: "text-slate-400", bg: "bg-slate-500/15" };
                return (
                  <div
                    key={t.id}
                    className={`px-4 py-3 flex items-center gap-3 transition-colors ${won ? "hover:bg-emerald-500/[0.03]" : "hover:bg-red-500/[0.03]"}`}
                  >
                    {/* Color bar */}
                    <div className={`w-1 h-9 rounded-full shrink-0 ${won ? "bg-emerald-500/60" : "bg-red-500/60"}`} />

                    {/* Symbol + direction */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-white">{shortSym(t.symbol)}</span>
                        <MarketTag market={t.market} />
                        <span className={`text-[11px] font-semibold ${isBuy ? "text-emerald-400" : "text-red-400"}`}>
                          {isBuy ? "↑" : "↓"}
                        </span>
                        {/* Reason — always visible */}
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${reason.bg} ${reason.color}`}>
                          {reason.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600 flex-wrap">
                        <span className="font-mono">{fmtPrice(t.entry_price)} → {fmtPrice(t.close_price)}</span>
                        <span>·</span>
                        <span>{fmtDuration(t.open_time, t.close_time)}</span>
                        <span>·</span>
                        <span>{fmtDate(t.close_time)}</span>
                      </div>
                    </div>

                    {/* P&L */}
                    <div className="text-right shrink-0">
                      <p className={`text-base font-black tabular-nums ${won ? "text-emerald-400" : "text-red-400"}`}>
                        {won ? "+" : ""}${t.pnl_usd.toFixed(2)}
                      </p>
                      <p className={`text-xs ${won ? "text-emerald-400/70" : "text-red-400/70"}`}>
                        {t.pnl_pct >= 0 ? "+" : ""}{t.pnl_pct.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
          <AlertTriangle size={13} className="text-amber-400 shrink-0" />
          <p className="text-xs text-amber-200/60">
            Simulazione. Nessun denaro reale viene investito. I risultati passati non garantiscono quelli futuri.
          </p>
        </div>

      </div>
    </div>
  );
}
