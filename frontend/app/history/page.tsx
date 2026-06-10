"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, TrendingUp, TrendingDown,
  CheckCircle2, XCircle, Clock, SlidersHorizontal,
  Trash2, Target, BarChart3, Zap, Activity, Search,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  BarChart2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartTooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

import { getBackend } from "@/lib/backend";
const BACKEND = getBackend();

// ── Types ─────────────────────────────────────────────────────────────────────

type Signal = {
  id: number; timestamp: string; symbol: string; market: string; action: string;
  confidence: number; weighted_score: number; price_at_signal: number;
  stop_loss: number | null; take_profit: number | null;
  regime: string; mtf_trend: string; divergence: string; candle_signal: string;
  pct_4h: number | null; ok_4h: number | null;
  pct_24h: number | null; ok_24h: number | null;
};

type ChartEntry = {
  symbol: string; total: number; correct: number; wrong: number;
  pending: number; accuracy: number | null;
};

type ChartData = { crypto: ChartEntry[]; forex: ChartEntry[] };

// ── Formatting ────────────────────────────────────────────────────────────────

function fmtTs(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }),
    time: d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
  };
}

function fmtPrice(v: number): string {
  if (v >= 10000) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (v >= 100)   return `$${v.toFixed(2)}`;
  if (v >= 1)     return `$${v.toFixed(4)}`;
  return `${v.toFixed(5)}`;
}

function shortSym(sym: string): string {
  return sym.replace("=X", "").replace("USDT", "").slice(0, 8);
}

// ── Sub-components ────────────────────────────────────────────────────────────

const ACTION_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  STRONG_BUY:  { label: "Forte ↑", color: "text-emerald-300", bg: "bg-emerald-500/15 border-emerald-400/30", dot: "bg-emerald-300" },
  BUY:         { label: "Acquisto", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-400" },
  SELL:        { label: "Vendita",  color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20",         dot: "bg-red-400"     },
  STRONG_SELL: { label: "Forte ↓", color: "text-red-300",     bg: "bg-red-500/15 border-red-400/30",         dot: "bg-red-300"     },
};

const MARKET_CFG: Record<string, { label: string; color: string; pill: string }> = {
  crypto: { label: "Crypto", color: "text-blue-400",    pill: "bg-blue-500/10 text-blue-400 border-blue-500/20"          },
  forex:  { label: "Forex",  color: "text-emerald-400", pill: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
};

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_CFG[action];
  if (!cfg) return <span className="text-[10px] text-slate-400">{action}</span>;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.bg} ${cfg.color}`}>
      {action.includes("BUY") ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
      {cfg.label}
    </span>
  );
}

function OutcomePill({ ok, pct }: { ok: number | null; pct: number | null }) {
  if (ok === null)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-slate-500 bg-slate-500/8 border border-slate-500/15">
        <Clock size={8} /> attesa
      </span>
    );
  const sign = pct != null ? `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%` : "";
  if (ok === 1)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25">
        <CheckCircle2 size={8} /> {sign || "✓"}
      </span>
    );
  if (ok === 0)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-red-400 bg-red-500/10 border border-red-500/25">
        <XCircle size={8} /> {sign || "✗"}
      </span>
    );
  return <span className="text-[10px] text-slate-500 tabular">{sign || "—"}</span>;
}

function StatCard({
  label, value, sub, icon, accent,
}: {
  label: string; value: React.ReactNode; sub?: string;
  icon: React.ReactNode; accent: string;
}) {
  return (
    <div className={`bg-[#0e1b2e] border rounded-xl p-4 flex items-start gap-3 ${accent}`}>
      <div className="mt-0.5 text-[var(--text-3)]">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-[var(--text-3)] uppercase tracking-wide mb-1">{label}</p>
        <p className="text-xl font-black tabular leading-none">{value}</p>
        {sub && <p className="text-[10px] text-[var(--text-3)] mt-1 leading-tight">{sub}</p>}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MarketTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const correct = (payload.find((p: { dataKey: string }) => p.dataKey === "correct")?.value ?? 0) as number;
  const wrong   = (payload.find((p: { dataKey: string }) => p.dataKey === "wrong")?.value   ?? 0) as number;
  const pending = (payload.find((p: { dataKey: string }) => p.dataKey === "pending")?.value ?? 0) as number;
  const evaluated = correct + wrong;
  const acc = evaluated > 0 ? Math.round(correct / evaluated * 100) : null;
  return (
    <div className="bg-[#0a1525] border border-[#1a3050] rounded-xl px-3 py-2.5 text-[11px] shadow-2xl">
      <p className="font-bold text-white mb-2">{label}</p>
      <div className="flex flex-col gap-1">
        {evaluated > 0 && <>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-sm bg-emerald-400" />
            <span className="text-[var(--text-3)]">Corretti</span>
            <span className="ml-auto font-semibold text-emerald-400">{correct}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-sm bg-red-400" />
            <span className="text-[var(--text-3)]">Errati</span>
            <span className="ml-auto font-semibold text-red-400">{wrong}</span>
          </div>
        </>}
        {pending > 0 && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-sm bg-slate-600" />
            <span className="text-[var(--text-3)]">In attesa</span>
            <span className="ml-auto text-slate-400">{pending}</span>
          </div>
        )}
        {acc !== null && (
          <div className="border-t border-[#1a3050] mt-1 pt-1 flex items-center gap-2">
            <span className="text-[var(--text-3)]">Accuracy</span>
            <span className={`ml-auto font-bold ${acc >= 60 ? "text-emerald-400" : acc >= 50 ? "text-amber-400" : "text-red-400"}`}>
              {acc}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function MarketChart({
  title, data, accentColor, pillClass,
}: {
  title: string; data: ChartEntry[]; accentColor: string; pillClass: string;
}) {
  const items = data.slice(0, 10).map(d => ({ ...d, symbol: shortSym(d.symbol) }));
  const totalSignals = data.reduce((s, d) => s + d.total, 0);
  const totalEval    = data.reduce((s, d) => s + d.correct + d.wrong, 0);
  const totalCorrect = data.reduce((s, d) => s + d.correct, 0);
  const marketAcc    = totalEval > 0 ? Math.round(totalCorrect / totalEval * 100) : null;

  return (
    <div className="bg-[#0e1b2e] border border-[#1a2e48] rounded-xl overflow-hidden">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${accentColor}`}>{title}</span>
          {marketAcc !== null && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${pillClass}`}>
              {marketAcc}%
            </span>
          )}
        </div>
        <span className="text-[10px] text-[var(--text-3)]">{totalSignals} segnali</span>
      </div>
      {items.length === 0 ? (
        <div className="h-[150px] flex flex-col items-center justify-center gap-2 pb-4">
          <BarChart3 size={24} className="text-[#1a2e48]" />
          <p className="text-[11px] text-[var(--text-3)]">Nessun segnale ancora</p>
        </div>
      ) : (
        <div className="px-2 pb-4">
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={items} barSize={14} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2e48" vertical={false} />
              <XAxis dataKey="symbol" tick={{ fill: "#475569", fontSize: 8 }} tickLine={false} axisLine={false} interval={0} />
              <YAxis tick={{ fill: "#475569", fontSize: 8 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <RechartTooltip content={<MarketTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="correct" stackId="a" fill="#34d399" />
              <Bar dataKey="wrong"   stackId="a" fill="#f87171" />
              <Bar dataKey="pending" stackId="a" fill="#334155" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-4 mt-2">
            {[
              { color: "bg-emerald-400", label: "Corretti"  },
              { color: "bg-red-400",     label: "Errati"    },
              { color: "bg-slate-600",   label: "In attesa" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-sm ${color}`} />
                <span className="text-[9px] text-[var(--text-3)]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 55 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1 rounded-full bg-[#1a2e48] overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] tabular text-[var(--text-2)]">{pct}%</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const [signals,     setSignals]     = useState<Signal[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [market,      setMarket]      = useState("all");
  const [action,      setAction]      = useState("all");
  const [search,      setSearch]      = useState("");
  const [dateRange,   setDateRange]   = useState<"all" | "today" | "7d" | "30d">("all");
  const [sortKey,     setSortKey]     = useState<"timestamp" | "symbol" | "pct_24h">("timestamp");
  const [sortAsc,     setSortAsc]     = useState(false);
  const [page,        setPage]        = useState(1);
  const [pageSize,    setPageSize]    = useState(25);
  const [chartData,   setChartData]   = useState<ChartData>({ crypto: [], forex: [] });
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "300" });
      if (market !== "all") params.set("market", market);
      if (action !== "all") params.set("action", action);
      const res  = await fetch(`${BACKEND}/api/signals?${params}`);
      const data = await res.json() as Signal[];
      setSignals(Array.isArray(data) ? data : []);
    } catch { setSignals([]); }
    finally { setLoading(false); }
  }, [market, action]);

  const fetchCharts = useCallback(async () => {
    try {
      const [c, f] = await Promise.all([
        fetch(`${BACKEND}/api/signals/chart/crypto`).then(r => r.json()).catch(() => []),
        fetch(`${BACKEND}/api/signals/chart/forex`).then(r => r.json()).catch(() => []),
      ]);
      setChartData({
        crypto: Array.isArray(c) ? c : [],
        forex:  Array.isArray(f) ? f : [],
      });
    } catch { /* noop */ }
  }, []);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);
  useEffect(() => { fetchCharts(); },  [fetchCharts]);

  async function handleCleanup() {
    if (!confirm("Eliminare tutti i segnali senza Stop Loss o Take Profit?\nL'operazione è irreversibile.")) return;
    setCleanupBusy(true);
    try {
      const res  = await fetch(`${BACKEND}/api/signals/cleanup`, { method: "POST" });
      const data = await res.json() as { deleted: number };
      await Promise.all([fetchSignals(), fetchCharts()]);
      if (data.deleted > 0) alert(`${data.deleted} record eliminati con successo.`);
    } finally { setCleanupBusy(false); }
  }

  const evaluated = useMemo(() => signals.filter(s => s.ok_24h !== null), [signals]);
  const correct   = useMemo(() => evaluated.filter(s => s.ok_24h === 1).length, [evaluated]);
  const pending   = useMemo(() => signals.filter(s => s.ok_24h === null).length, [signals]);
  const accuracy  = evaluated.length > 0 ? Math.round(correct / evaluated.length * 100) : null;

  const regimeAcc = useMemo(() => {
    const byRegime = (r: string) => {
      const pool = evaluated.filter(s => s.regime === r);
      return pool.length > 0 ? Math.round(pool.filter(s => s.ok_24h === 1).length / pool.length * 100) : null;
    };
    return { trending: byRegime("trending"), ranging: byRegime("ranging") };
  }, [evaluated]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const cutoff: number | null =
      dateRange === "today" ? new Date(new Date().setHours(0, 0, 0, 0)).getTime() :
      dateRange === "7d"    ? now - 7  * 86_400_000 :
      dateRange === "30d"   ? now - 30 * 86_400_000 : null;
    return [...signals]
      .filter(s => !q || s.symbol.toLowerCase().includes(q))
      .filter(s => cutoff === null || new Date(s.timestamp).getTime() >= cutoff)
      .sort((a, b) => {
        let cmp = 0;
        if (sortKey === "timestamp") cmp = a.timestamp.localeCompare(b.timestamp);
        if (sortKey === "symbol")    cmp = a.symbol.localeCompare(b.symbol);
        if (sortKey === "pct_24h")   cmp = (a.pct_24h ?? -999) - (b.pct_24h ?? -999);
        return sortAsc ? cmp : -cmp;
      });
  }, [signals, search, dateRange, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated  = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [market, action, search, dateRange, sortKey, sortAsc, pageSize]);

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortAsc(p => !p);
    else { setSortKey(key); setSortAsc(false); }
  }

  const pageStart = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd   = Math.min(page * pageSize, filtered.length);
  const filtersActive = market !== "all" || action !== "all" || dateRange !== "all" || search !== "";

  function pageNumbers(): (number | "…")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "…")[] = [1];
    if (page > 3)           pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
    return pages;
  }

  const SortTh = ({ col, children }: { col: typeof sortKey; children: React.ReactNode }) => (
    <th
      className="px-3 py-3 text-left text-[10px] font-semibold text-[var(--text-3)] uppercase tracking-wide cursor-pointer select-none hover:text-white transition-colors whitespace-nowrap"
      onClick={() => toggleSort(col)}
    >
      {children}{sortKey === col ? (sortAsc ? " ↑" : " ↓") : ""}
    </th>
  );

  function rowStyle(s: Signal) {
    if (s.ok_24h === 1) return "border-l-2 border-emerald-500/40 bg-emerald-500/[0.03] hover:bg-emerald-500/[0.06]";
    if (s.ok_24h === 0) return "border-l-2 border-red-500/40 bg-red-500/[0.03] hover:bg-red-500/[0.06]";
    return "border-l-2 border-transparent hover:bg-[#111d30]";
  }

  return (
    <div className="h-full bg-[#070c18] text-white flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#1a2e48] bg-[#070c18]/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-[var(--text-2)] hover:text-white hover:bg-[#111d30] border border-[#1a2e48] transition-all">
            <ArrowLeft size={12} /> Dashboard
          </Link>
          <div>
            <h1 className="text-sm font-bold text-white leading-none">Storico Segnali</h1>
            <p className="text-[10px] text-[var(--text-3)] mt-0.5">{signals.length} segnali · {evaluated.length} valutati</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/stats" className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#1a2e48] text-[var(--text-2)] bg-[#0d1829] hover:border-violet-500/40 hover:text-white transition-all">
            <BarChart2 size={11} /> Stats
          </Link>
          <button onClick={handleCleanup} disabled={cleanupBusy} title="Elimina segnali senza SL/TP"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-red-500/25 text-red-400/70 hover:border-red-500/50 hover:text-red-300 transition-all disabled:opacity-40">
            <Trash2 size={11} />
            <span className="hidden sm:inline">Pulizia DB</span>
          </button>
          <button onClick={fetchSignals} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#1a2e48] text-[var(--text-2)] bg-[#0d1829] hover:border-blue-500/40 hover:text-white transition-all disabled:opacity-50">
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Aggiorna</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-4 py-5 max-w-7xl mx-auto w-full flex flex-col gap-5 pb-20 md:pb-6">

        {/* ── Hero stats ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Segnali totali"
            value={<span className="text-white">{signals.length}</span>}
            sub={`${evaluated.length} già valutati`}
            icon={<Activity size={16} />} accent="border-[#1a2e48]" />
          <StatCard label="Accuratezza 24h"
            value={accuracy != null
              ? <span className={accuracy >= 60 ? "text-emerald-400" : accuracy >= 50 ? "text-amber-400" : "text-red-400"}>{accuracy}%</span>
              : <span className="text-slate-500 text-base">—</span>}
            sub={evaluated.length > 0 ? `${correct} corretti su ${evaluated.length}` : "dati insufficienti"}
            icon={<Target size={16} />}
            accent={accuracy != null && accuracy >= 60 ? "border-emerald-500/20" : "border-[#1a2e48]"} />
          <StatCard label="Regime trending"
            value={regimeAcc.trending != null
              ? <span className={regimeAcc.trending >= 60 ? "text-emerald-400" : "text-amber-400"}>{regimeAcc.trending}%</span>
              : <span className="text-slate-500 text-base">—</span>}
            sub="ADX > 25"
            icon={<TrendingUp size={16} />} accent="border-[#1a2e48]" />
          <StatCard label="In attesa"
            value={<span className="text-amber-400">{pending}</span>}
            sub="outcome non ancora disponibile"
            icon={<Clock size={16} />}
            accent={pending > 0 ? "border-amber-500/15" : "border-[#1a2e48]"} />
        </div>

        {/* ── Charts ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <MarketChart title="Crypto" data={chartData.crypto} accentColor="text-blue-400"
            pillClass="bg-blue-500/10 text-blue-400 border border-blue-500/20" />
          <MarketChart title="Forex" data={chartData.forex} accentColor="text-emerald-400"
            pillClass="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" />
        </div>

        {/* ── Segnali ────────────────────────────────────────────────────── */}
        <div className="bg-[#0e1b2e] border border-[#1a2e48] rounded-xl overflow-hidden">

          {/* Toolbar */}
          <div className="px-4 py-3 border-b border-[#1a2e48] flex flex-col gap-2.5">
            {/* Search + per-page + filter toggle */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-xs">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)] pointer-events-none" />
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Cerca simbolo…"
                  className="w-full bg-[#0a1525] border border-[#1a2e48] text-[var(--text-2)] text-xs rounded-lg pl-7 pr-7 py-1.5 focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-[var(--text-3)]"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-white text-base leading-none">×</button>
                )}
              </div>
              {/* Mobile: filter toggle button */}
              <button
                onClick={() => setFiltersOpen(o => !o)}
                className={`md:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-all ${
                  filtersActive
                    ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                    : "text-slate-500 border-[#1a2e48] hover:text-slate-300"
                }`}
              >
                <SlidersHorizontal size={11} />
                Filtri{filtersActive ? " ●" : ""}
              </button>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-[10px] text-[var(--text-3)] hidden sm:inline">Righe:</span>
                {[10, 25, 50, 100].map(n => (
                  <button key={n} onClick={() => setPageSize(n)}
                    className={`text-[10px] font-semibold px-2 py-1 rounded-md border transition-all ${
                      pageSize === n ? "bg-blue-500/15 text-blue-400 border-blue-500/30" : "text-[var(--text-3)] border-[#1a2e48] hover:text-white"
                    }`}>{n}</button>
                ))}
              </div>
            </div>

            {/* Filters — always visible on desktop, collapsible on mobile */}
            <div className={`flex-col gap-2 ${filtersOpen ? "flex" : "hidden md:flex"}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <SlidersHorizontal size={11} className="text-[var(--text-3)] shrink-0 hidden md:block" />
                {["all", "crypto", "forex"].map(m => (
                  <button key={m} onClick={() => setMarket(m)}
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-md border transition-all ${
                      market === m ? "bg-blue-500/15 text-blue-400 border-blue-500/30" : "text-[var(--text-3)] border-transparent hover:border-[#1a2e48] hover:text-[var(--text-2)]"
                    }`}>
                    {m === "all" ? "Tutti" : m === "crypto" ? "Crypto" : "Forex"}
                  </button>
                ))}
                <div className="w-px h-4 bg-[#1a2e48] mx-1" />
                {["all", "STRONG_BUY", "BUY", "SELL", "STRONG_SELL"].map(a => (
                  <button key={a} onClick={() => setAction(a)}
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-md border transition-all ${
                      action === a ? "bg-blue-500/15 text-blue-400 border-blue-500/30" : "text-[var(--text-3)] border-transparent hover:border-[#1a2e48] hover:text-[var(--text-2)]"
                    }`}>
                    {a === "all" ? "Tutte" : a === "STRONG_BUY" ? "Forte ↑" : a === "BUY" ? "Acquisto" : a === "STRONG_SELL" ? "Forte ↓" : "Vendita"}
                  </button>
                ))}
                <div className="w-px h-4 bg-[#1a2e48] mx-1" />
                {(["all", "today", "7d", "30d"] as const).map(d => (
                  <button key={d} onClick={() => setDateRange(d)}
                    className={`text-[10px] font-semibold px-2.5 py-1 rounded-md border transition-all ${
                      dateRange === d ? "bg-violet-500/15 text-violet-400 border-violet-500/30" : "text-[var(--text-3)] border-transparent hover:border-[#1a2e48] hover:text-[var(--text-2)]"
                    }`}>
                    {d === "all" ? "Sempre" : d === "today" ? "Oggi" : d === "7d" ? "7gg" : "30gg"}
                  </button>
                ))}
                {filtersActive && (
                  <button
                    onClick={() => { setSearch(""); setMarket("all"); setAction("all"); setDateRange("all"); }}
                    className="text-[10px] text-[var(--text-3)] hover:text-white ml-auto underline underline-offset-2 transition-colors"
                  >
                    Azzera
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Body */}
          {loading ? (
            <div className="flex flex-col">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-[#0d1829] animate-pulse">
                  <div className="h-3 w-14 bg-[#1a2e48] rounded" />
                  <div className="h-3 w-20 bg-[#1a2e48] rounded" />
                  <div className="h-5 w-24 bg-[#1a2e48] rounded-full" />
                  <div className="h-3 w-16 bg-[#1a2e48] rounded ml-auto" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#111d30] border border-[#1a2e48] flex items-center justify-center">
                <Zap size={22} className="text-[var(--text-3)]" />
              </div>
              <div className="text-center px-4">
                <p className="text-sm font-semibold text-[var(--text-2)]">
                  {market !== "all" || action !== "all" ? "Nessun risultato per i filtri selezionati" : "Nessun segnale ancora registrato"}
                </p>
                <p className="text-xs text-[var(--text-3)] mt-1 max-w-xs mx-auto">
                  {market !== "all" || action !== "all"
                    ? "Prova a modificare i filtri per vedere altri segnali."
                    : "I segnali BUY e SELL vengono salvati automaticamente ogni ciclo di analisi."}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* ── Mobile: card rows (below md) ── */}
              <div className="md:hidden divide-y divide-[#0d1829]">
                {paginated.map(s => {
                  const ts = fmtTs(s.timestamp);
                  const won = s.ok_24h === 1;
                  const lost = s.ok_24h === 0;
                  return (
                    <div key={s.id} className={`px-4 py-3.5 ${
                      won ? "border-l-2 border-emerald-500/40 bg-emerald-500/[0.03]" :
                      lost ? "border-l-2 border-red-500/40 bg-red-500/[0.03]" :
                      "border-l-2 border-transparent"
                    }`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-white">{shortSym(s.symbol)}</span>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${MARKET_CFG[s.market]?.pill ?? ""}`}>
                            {MARKET_CFG[s.market]?.label ?? s.market}
                          </span>
                        </div>
                        <ActionBadge action={s.action} />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col gap-1.5">
                          <ConfBar value={s.confidence ?? 0} />
                          <span className="text-[10px] text-slate-500 font-mono tabular">{ts.date} {ts.time}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-[9px] text-slate-600 mb-0.5">4h</p>
                            <OutcomePill ok={s.ok_4h} pct={s.pct_4h} />
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] text-slate-600 mb-0.5">24h</p>
                            <OutcomePill ok={s.ok_24h} pct={s.pct_24h} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Desktop: table (md+) ── */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead className="sticky top-0 z-10 border-b border-[#1a2e48] bg-[#080f1e]">
                    <tr>
                      <SortTh col="timestamp">Data</SortTh>
                      <SortTh col="symbol">Asset</SortTh>
                      <th className="px-3 py-3 text-left text-[10px] font-semibold text-[var(--text-3)] uppercase tracking-wide">Azione</th>
                      <th className="px-3 py-3 text-left text-[10px] font-semibold text-[var(--text-3)] uppercase tracking-wide">Conf.</th>
                      <th className="px-3 py-3 text-left text-[10px] font-semibold text-[var(--text-3)] uppercase tracking-wide">Prezzo</th>
                      <th className="px-3 py-3 text-left text-[10px] font-semibold text-[var(--text-3)] uppercase tracking-wide hidden lg:table-cell">SL / TP</th>
                      <th className="px-3 py-3 text-left text-[10px] font-semibold text-[var(--text-3)] uppercase tracking-wide hidden lg:table-cell">Regime</th>
                      <th className="px-3 py-3 text-left text-[10px] font-semibold text-[var(--text-3)] uppercase tracking-wide">4h</th>
                      <SortTh col="pct_24h">24h</SortTh>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map(s => {
                      const mcfg = MARKET_CFG[s.market];
                      const ts   = fmtTs(s.timestamp);
                      return (
                        <tr key={s.id} className={`border-b border-[#0d1829] transition-colors text-xs ${rowStyle(s)}`}>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="font-mono text-[var(--text-2)] text-[11px]">{ts.date}</div>
                            <div className="text-[var(--text-3)] text-[9px]">{ts.time}</div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-bold text-white text-[11px]">{s.symbol}</div>
                            {mcfg && (
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${mcfg.pill}`}>
                                {mcfg.label}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <ActionBadge action={s.action} />
                          </td>
                          <td className="px-3 py-3">
                            <ConfBar value={s.confidence ?? 0} />
                          </td>
                          <td className="px-3 py-3 tabular font-mono text-[var(--text-2)] whitespace-nowrap">
                            {s.price_at_signal != null ? fmtPrice(s.price_at_signal) : "—"}
                          </td>
                          <td className="px-3 py-3 hidden lg:table-cell">
                            {s.stop_loss != null ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] text-red-400 font-mono tabular">↓ {fmtPrice(s.stop_loss)}</span>
                                {s.take_profit != null && (
                                  <span className="text-[10px] text-emerald-400 font-mono tabular">↑ {fmtPrice(s.take_profit)}</span>
                                )}
                              </div>
                            ) : <span className="text-slate-600 text-[10px]">—</span>}
                          </td>
                          <td className="px-3 py-3 hidden lg:table-cell">
                            <div className={`text-[10px] font-medium ${
                              s.regime === "trending" ? "text-blue-400" :
                              s.regime === "ranging"  ? "text-amber-400" : "text-slate-500"
                            }`}>{s.regime ?? "—"}</div>
                            <div className={`text-[9px] ${
                              s.mtf_trend === "up"   ? "text-emerald-400" :
                              s.mtf_trend === "down" ? "text-red-400"     : "text-slate-600"
                            }`}>
                              {s.mtf_trend === "up" ? "↑ MTF up" : s.mtf_trend === "down" ? "↓ MTF down" : ""}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <OutcomePill ok={s.ok_4h} pct={s.pct_4h} />
                          </td>
                          <td className="px-3 py-3">
                            <OutcomePill ok={s.ok_24h} pct={s.pct_24h} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Pagination */}
          {!loading && filtered.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#1a2e48] flex-wrap gap-2">
              <span className="text-[10px] text-[var(--text-3)]">
                <span className="text-[var(--text-2)] font-semibold tabular">{pageStart}–{pageEnd}</span> di{" "}
                <span className="text-[var(--text-2)] font-semibold tabular">{filtered.length}</span>
                {filtered.length !== signals.length && <span className="text-amber-400/70"> (filtrati da {signals.length})</span>}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(1)} disabled={page === 1}
                    className="p-1.5 rounded-md text-[var(--text-3)] hover:text-white hover:bg-[#111d30] border border-transparent hover:border-[#1a2e48] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    <ChevronsLeft size={12} />
                  </button>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded-md text-[var(--text-3)] hover:text-white hover:bg-[#111d30] border border-transparent hover:border-[#1a2e48] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    <ChevronLeft size={12} />
                  </button>
                  {pageNumbers().map((n, i) =>
                    n === "…" ? (
                      <span key={`e-${i}`} className="px-1.5 text-[10px] text-[var(--text-3)]">…</span>
                    ) : (
                      <button key={n} onClick={() => setPage(n as number)}
                        className={`min-w-[28px] h-7 px-1.5 rounded-md text-[10px] font-semibold border transition-all ${
                          page === n ? "bg-blue-500/20 text-blue-400 border-blue-500/40" : "text-[var(--text-3)] border-transparent hover:border-[#1a2e48] hover:text-white"
                        }`}>{n}</button>
                    )
                  )}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-1.5 rounded-md text-[var(--text-3)] hover:text-white hover:bg-[#111d30] border border-transparent hover:border-[#1a2e48] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    <ChevronRight size={12} />
                  </button>
                  <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                    className="p-1.5 rounded-md text-[var(--text-3)] hover:text-white hover:bg-[#111d30] border border-transparent hover:border-[#1a2e48] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                    <ChevronsRight size={12} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
