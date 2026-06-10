"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, TrendingUp, TrendingDown,
  DollarSign, Activity, Target, Briefcase,
  CheckCircle2, XCircle, Clock, X, Trophy,
  AlertTriangle, BarChart2, Filter,
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

const REASON_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  TP:      { label: "Take Profit", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
  SL:      { label: "Stop Loss",   color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/25"     },
  REVERSE: { label: "Inversione",  color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/25"   },
  SIGNAL:  { label: "Segnale",     color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/25"    },
  MANUAL:  { label: "Manuale",     color: "text-slate-400",   bg: "bg-slate-500/10",   border: "border-slate-500/20"   },
};

function pct(a: number, b: number): number {
  return b === 0 ? 0 : Math.round((a / b) * 100);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, accent, pill,
}: {
  label: string; value: React.ReactNode; sub?: string;
  icon: React.ReactNode; accent?: string; pill?: React.ReactNode;
}) {
  return (
    <div className={`bg-[#0e1b2e] border rounded-xl p-4 flex flex-col gap-2 ${accent ?? "border-[#1a2e48]"}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{label}</span>
        <span className="text-slate-600">{icon}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-[22px] font-black tabular leading-none">{value}</p>
        {pill}
      </div>
      {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
    </div>
  );
}

function DirectionBadge({ dir }: { dir: string }) {
  const isBuy = dir === "BUY";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
      isBuy
        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
        : "bg-red-500/10 text-red-400 border-red-500/20"
    }`}>
      {isBuy ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
      {isBuy ? "LONG" : "SHORT"}
    </span>
  );
}

function MarketBadge({ market }: { market: string }) {
  const isCrypto = market === "crypto";
  return (
    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
      isCrypto
        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
        : "bg-violet-500/10 text-violet-400 border-violet-500/20"
    }`}>{isCrypto ? "Crypto" : "Forex"}</span>
  );
}

function SlTpBar({ entry, sl, tp, direction }: {
  entry: number; sl: number | null; tp: number | null; direction: string;
}) {
  if (!sl && !tp) return null;
  const isBuy = direction === "BUY";

  const slPct = sl ? Math.abs((sl - entry) / entry * 100) : null;
  const tpPct = tp ? Math.abs((tp - entry) / entry * 100) : null;
  const maxRange = Math.max(slPct ?? 0, tpPct ?? 0, 0.001);

  const slWidth = slPct ? Math.min((slPct / maxRange) * 45, 45) : 0;
  const tpWidth = tpPct ? Math.min((tpPct / maxRange) * 45, 45) : 0;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1 h-4 rounded-full overflow-hidden bg-[#0d1829]">
        {isBuy ? (
          <>
            <div className="bg-red-500/30 h-full flex items-center justify-end pr-1" style={{ width: `${slWidth}%` }}>
              {slPct && slPct > 1 && <span className="text-[8px] text-red-400 font-mono">{slPct.toFixed(1)}%</span>}
            </div>
            <div className="w-0.5 h-3 bg-slate-400 rounded-full shrink-0" />
            <div className="bg-emerald-500/30 h-full flex items-center justify-start pl-1" style={{ width: `${tpWidth}%` }}>
              {tpPct && tpPct > 1 && <span className="text-[8px] text-emerald-400 font-mono">{tpPct.toFixed(1)}%</span>}
            </div>
          </>
        ) : (
          <>
            <div className="bg-emerald-500/30 h-full flex items-center justify-end pr-1" style={{ width: `${tpWidth}%` }}>
              {tpPct && tpPct > 1 && <span className="text-[8px] text-emerald-400 font-mono">{tpPct.toFixed(1)}%</span>}
            </div>
            <div className="w-0.5 h-3 bg-slate-400 rounded-full shrink-0" />
            <div className="bg-red-500/30 h-full flex items-center justify-start pl-1" style={{ width: `${slWidth}%` }}>
              {slPct && slPct > 1 && <span className="text-[8px] text-red-400 font-mono">{slPct.toFixed(1)}%</span>}
            </div>
          </>
        )}
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] text-slate-600">SL {sl ? fmtPrice(sl) : "—"}</span>
        <span className="text-[9px] text-slate-600">TP {tp ? fmtPrice(tp) : "—"}</span>
      </div>
    </div>
  );
}

function FilterBtn({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap ${
        active
          ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
          : "bg-transparent text-slate-500 border-[#1a2e48] hover:text-slate-300 hover:border-slate-600"
      }`}
    >
      {children}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type MarketFilter = "all" | "crypto" | "forex";
type ResultFilter = "all" | "win" | "loss";
type DateFilter   = "all" | "today" | "7d" | "30d";

export default function PortfolioPage() {
  const [summary,    setSummary]    = useState<Summary | null>(null);
  const [open,       setOpen]       = useState<OpenTrade[]>([]);
  const [history,    setHistory]    = useState<ClosedTrade[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [closing,    setClosing]    = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // History filters
  const [fMarket, setFMarket] = useState<MarketFilter>("all");
  const [fResult, setFResult] = useState<ResultFilter>("all");
  const [fDate,   setFDate]   = useState<DateFilter>("all");

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

  // ── Filters ───────────────────────────────────────────────────────────────

  const filteredHistory = useMemo(() => {
    const now = Date.now();
    return history.filter(t => {
      if (fMarket !== "all" && t.market !== fMarket) return false;
      if (fResult === "win"  && t.pnl_usd <= 0) return false;
      if (fResult === "loss" && t.pnl_usd > 0)  return false;
      if (fDate !== "all") {
        const age = now - new Date(t.close_time).getTime();
        if (fDate === "today" && age > 86400000)    return false;
        if (fDate === "7d"    && age > 7 * 86400000) return false;
        if (fDate === "30d"   && age > 30 * 86400000) return false;
      }
      return true;
    });
  }, [history, fMarket, fResult, fDate]);

  // ── Extra stats ───────────────────────────────────────────────────────────

  const extraStats = useMemo(() => {
    if (history.length === 0) return null;
    const wins   = history.filter(t => t.pnl_usd > 0);
    const losses = history.filter(t => t.pnl_usd <= 0);
    const totalWin  = wins.reduce((s, t) => s + t.pnl_usd, 0);
    const totalLoss = Math.abs(losses.reduce((s, t) => s + t.pnl_usd, 0));
    const profitFactor = totalLoss > 0 ? totalWin / totalLoss : wins.length > 0 ? 999 : 0;
    const avgWin  = wins.length  > 0 ? totalWin  / wins.length  : 0;
    const avgLoss = losses.length > 0 ? totalLoss / losses.length : 0;
    const best = history.reduce((m, t) => t.pnl_usd > m.pnl_usd ? t : m, history[0]);
    return { profitFactor, avgWin, avgLoss, best };
  }, [history]);

  const totalPnl = summary?.total_pnl_usd ?? 0;
  const equity   = summary?.equity ?? 10000;
  const pnlPct   = ((equity - 10000) / 10000 * 100);

  const filtersActive = fMarket !== "all" || fResult !== "all" || fDate !== "all";

  return (
    <div className="min-h-screen bg-[#070c18] text-white flex flex-col">

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a2e48] bg-[#070c18]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-white hover:bg-[#111d30] border border-[#1a2e48] transition-all">
            <ArrowLeft size={12} /> Dashboard
          </Link>
          <div>
            <h1 className="text-sm font-bold text-white leading-none">Paper Portfolio</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">Simulazione · $1.000 per posizione</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#1a2e48] text-slate-300 bg-[#0d1829] hover:border-blue-500/40 hover:text-white transition-all disabled:opacity-50"
        >
          <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
          <span className="hidden sm:inline">Controlla SL/TP</span>
        </button>
      </header>

      <div className="flex-1 overflow-auto px-4 py-5 max-w-6xl mx-auto w-full flex flex-col gap-5">

        {/* ── Summary cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Equity"
            value={
              <span className={equity >= 10000 ? "text-emerald-400" : "text-red-400"}>
                ${equity.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </span>
            }
            sub="capitale iniziale $10.000"
            icon={<DollarSign size={14} />}
            accent={equity >= 10000 ? "border-emerald-500/20" : "border-red-500/20"}
            pill={
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pnlPct >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
              </span>
            }
          />
          <StatCard
            label="P&L totale"
            value={
              <span className={totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                {totalPnl >= 0 ? "+" : ""}${Math.abs(totalPnl).toFixed(2)}
              </span>
            }
            sub={`${summary?.win_count ?? 0} vinte · ${summary?.loss_count ?? 0} perse`}
            icon={<Activity size={14} />}
          />
          <StatCard
            label="Win Rate"
            value={
              summary?.win_rate != null
                ? <span className={summary.win_rate >= 60 ? "text-emerald-400" : summary.win_rate >= 50 ? "text-amber-400" : "text-red-400"}>
                    {summary.win_rate}%
                  </span>
                : <span className="text-slate-500 text-lg">—</span>
            }
            sub={`${summary?.closed_trades ?? 0} trade totali`}
            icon={<Target size={14} />}
          />
          <StatCard
            label="Posizioni aperte"
            value={<span className="text-amber-400">{summary?.open_trades ?? 0}</span>}
            sub="check SL/TP ogni ora"
            icon={<Briefcase size={14} />}
            accent={(summary?.open_trades ?? 0) > 0 ? "border-amber-500/20" : "border-[#1a2e48]"}
          />
        </div>

        {/* ── Extra stats row ── */}
        {extraStats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Profit Factor"
              value={
                <span className={extraStats.profitFactor >= 1.5 ? "text-emerald-400" : extraStats.profitFactor >= 1 ? "text-amber-400" : "text-red-400"}>
                  {extraStats.profitFactor >= 100 ? "∞" : extraStats.profitFactor.toFixed(2)}
                </span>
              }
              sub="guadagni / perdite totali"
              icon={<BarChart2 size={14} />}
            />
            <StatCard
              label="Guadagno medio"
              value={<span className="text-emerald-400">+${extraStats.avgWin.toFixed(2)}</span>}
              sub="per trade vincente"
              icon={<TrendingUp size={14} />}
            />
            <StatCard
              label="Perdita media"
              value={<span className="text-red-400">-${extraStats.avgLoss.toFixed(2)}</span>}
              sub="per trade perdente"
              icon={<TrendingDown size={14} />}
            />
            <StatCard
              label="Miglior trade"
              value={<span className="text-emerald-400">+${extraStats.best.pnl_usd.toFixed(2)}</span>}
              sub={shortSym(extraStats.best.symbol)}
              icon={<Trophy size={14} />}
            />
          </div>
        )}

        {/* ── Open positions ── */}
        <div className="bg-[#0e1b2e] border border-[#1a2e48] rounded-xl">
          <div className="px-4 py-3 border-b border-[#1a2e48] flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-bold text-slate-200">Posizioni Aperte</span>
            {open.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 font-bold">
                {open.length}
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => <div key={i} className="h-24 bg-[#1a2e48] rounded-xl animate-pulse" />)}
            </div>
          ) : open.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-2">
              <Briefcase size={22} className="text-slate-700" />
              <p className="text-sm text-slate-500 font-medium">Nessuna posizione aperta</p>
              <p className="text-xs text-slate-600">Le posizioni si aprono automaticamente sui segnali BUY/SELL</p>
            </div>
          ) : (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {open.map(t => (
                <div key={t.id} className="bg-[#080f1e] border border-[#1a2e48] rounded-xl p-3 flex flex-col gap-2 hover:border-[#243d60] transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-white">{shortSym(t.symbol)}</span>
                      <MarketBadge market={t.market} />
                    </div>
                    <DirectionBadge dir={t.direction} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[9px] text-slate-600 mb-0.5">Prezzo entrata</div>
                      <div className="text-[13px] font-bold font-mono tabular text-slate-100">{fmtPrice(t.entry_price)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] text-slate-600 mb-0.5">Dimensione</div>
                      <div className="text-[12px] font-bold text-slate-300">${t.size_usd.toLocaleString()}</div>
                    </div>
                  </div>

                  <SlTpBar entry={t.entry_price} sl={t.sl_price} tp={t.tp_price} direction={t.direction} />

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1 text-[10px] text-slate-600">
                      <Clock size={9} />
                      {fmtDuration(t.open_time)}
                    </div>
                    <button
                      onClick={() => handleClose(t.id)}
                      disabled={closing === t.id}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold border border-red-500/25 text-red-400 hover:border-red-500/50 hover:bg-red-500/10 transition-all disabled:opacity-40"
                    >
                      <X size={9} />
                      {closing === t.id ? "..." : "Chiudi"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Closed trades ── */}
        <div className="bg-[#0e1b2e] border border-[#1a2e48] rounded-xl overflow-hidden">

          {/* Section header + filters */}
          <div className="px-4 py-3 border-b border-[#1a2e48]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-slate-500" />
                <span className="text-xs font-bold text-slate-200">Storico Trade</span>
                {filtersActive && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25 font-bold">
                    filtrato
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-500">
                {filteredHistory.length}
                {filteredHistory.length !== history.length && ` / ${history.length}`}
                {" "}trade
              </span>
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1">
                <Filter size={10} className="text-slate-600" />
                <span className="text-[10px] text-slate-600 font-semibold uppercase tracking-wide">Mercato</span>
              </div>
              <FilterBtn active={fMarket === "all"}    onClick={() => setFMarket("all")}>Tutti</FilterBtn>
              <FilterBtn active={fMarket === "crypto"} onClick={() => setFMarket("crypto")}>Crypto</FilterBtn>
              <FilterBtn active={fMarket === "forex"}  onClick={() => setFMarket("forex")}>Forex</FilterBtn>

              <div className="w-px bg-[#1a2e48] mx-1" />

              <FilterBtn active={fResult === "all"}  onClick={() => setFResult("all")}>Tutti</FilterBtn>
              <FilterBtn active={fResult === "win"}  onClick={() => setFResult("win")}>
                <span className="text-emerald-400">✓</span> Vinte
              </FilterBtn>
              <FilterBtn active={fResult === "loss"} onClick={() => setFResult("loss")}>
                <span className="text-red-400">✗</span> Perse
              </FilterBtn>

              <div className="w-px bg-[#1a2e48] mx-1" />

              <FilterBtn active={fDate === "all"}   onClick={() => setFDate("all")}>Tutto</FilterBtn>
              <FilterBtn active={fDate === "today"} onClick={() => setFDate("today")}>Oggi</FilterBtn>
              <FilterBtn active={fDate === "7d"}    onClick={() => setFDate("7d")}>7 giorni</FilterBtn>
              <FilterBtn active={fDate === "30d"}   onClick={() => setFDate("30d")}>30 giorni</FilterBtn>

              {filtersActive && (
                <button
                  onClick={() => { setFMarket("all"); setFResult("all"); setFDate("all"); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="p-4 space-y-2">
              {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-[#1a2e48] rounded animate-pulse" />)}
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-2">
              <XCircle size={22} className="text-slate-700" />
              <p className="text-sm text-slate-500 font-medium">
                {history.length === 0 ? "Nessun trade chiuso ancora" : "Nessun risultato con questi filtri"}
              </p>
              {filtersActive && (
                <button
                  onClick={() => { setFMarket("all"); setFResult("all"); setFDate("all"); }}
                  className="text-xs text-blue-400 hover:text-blue-300 underline mt-1"
                >
                  Rimuovi filtri
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-auto max-h-[520px]">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 bg-[#08111e] border-b border-[#1a2e48] z-10">
                  <tr>
                    {["Asset", "Dir.", "Entrata → Uscita", "P&L $", "P&L %", "Motivo", "Durata", "Data"].map((h, i) => (
                      <th
                        key={h}
                        className={`px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap ${
                          i === 0 ? "text-left" :
                          i >= 5  ? "text-left hidden md:table-cell" :
                          i === 7 ? "text-right hidden lg:table-cell" :
                          "text-right"
                        } ${i === 2 ? "hidden sm:table-cell" : ""}`}
                      >{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map(t => {
                    const won    = t.pnl_usd > 0;
                    const reason = REASON_CFG[t.close_reason] ?? { label: t.close_reason, color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20" };
                    return (
                      <tr
                        key={t.id}
                        className={`border-b border-[#0d1829] transition-colors ${won ? "hover:bg-emerald-500/[0.04]" : "hover:bg-red-500/[0.04]"}`}
                      >
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-1 h-6 rounded-full shrink-0 ${won ? "bg-emerald-500/50" : "bg-red-500/50"}`} />
                            <div>
                              <div className="font-bold text-white text-[11px]">{shortSym(t.symbol)}</div>
                              <MarketBadge market={t.market} />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5"><DirectionBadge dir={t.direction} /></td>
                        <td className="px-3 py-2.5 hidden sm:table-cell">
                          <div className="text-[10px] font-mono tabular text-slate-500">{fmtPrice(t.entry_price)}</div>
                          <div className="text-[10px] font-mono tabular text-slate-300">→ {fmtPrice(t.close_price)}</div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={`text-[12px] font-bold tabular block ${won ? "text-emerald-400" : "text-red-400"}`}>
                            {won ? "+" : ""}${t.pnl_usd.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={`text-[11px] font-semibold tabular ${won ? "text-emerald-400/80" : "text-red-400/80"}`}>
                            {t.pnl_pct >= 0 ? "+" : ""}{t.pnl_pct.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-3 py-2.5 hidden md:table-cell">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${reason.bg} ${reason.color} ${reason.border}`}>
                            {reason.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 hidden md:table-cell">
                          <span className="text-[10px] text-slate-500">{fmtDuration(t.open_time, t.close_time)}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right hidden lg:table-cell">
                          <span className="text-[10px] text-slate-600 whitespace-nowrap">{fmtDate(t.close_time)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredHistory.length > 0 && summary && (
                <div className="px-4 py-3 border-t border-[#1a2e48] flex items-center gap-3">
                  <div className="flex-1 h-1.5 rounded-full bg-[#0d1829] overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-500/60 rounded-full transition-all"
                      style={{ width: `${pct(filteredHistory.filter(t => t.pnl_usd > 0).length, filteredHistory.length)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0">
                    <span className="text-emerald-400 font-bold">{filteredHistory.filter(t => t.pnl_usd > 0).length}</span> vinte
                    {" / "}
                    <span className="text-red-400 font-bold">{filteredHistory.filter(t => t.pnl_usd <= 0).length}</span> perse
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
          <AlertTriangle size={11} className="text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[10px] text-amber-200/70 leading-relaxed">
            Simulazione. Nessun denaro reale viene investito. I risultati passati non garantiscono quelli futuri.
          </p>
        </div>

      </div>
    </div>
  );
}
