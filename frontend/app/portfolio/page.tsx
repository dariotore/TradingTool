"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, TrendingUp, TrendingDown,
  DollarSign, Activity, Target, Briefcase,
  CheckCircle2, XCircle, Clock, X,
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

function shortSym(sym: string) {
  return sym.replace("=X", "").replace("USDT", "").slice(0, 8);
}

const REASON_LABELS: Record<string, { label: string; color: string }> = {
  TP:      { label: "Take Profit", color: "text-emerald-400" },
  SL:      { label: "Stop Loss",   color: "text-red-400"     },
  REVERSE: { label: "Inversione",  color: "text-amber-400"   },
  SIGNAL:  { label: "Segnale",     color: "text-blue-400"    },
  MANUAL:  { label: "Manuale",     color: "text-slate-400"   },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, accent,
}: {
  label: string; value: React.ReactNode; sub?: string;
  icon: React.ReactNode; accent?: string;
}) {
  return (
    <div className={`bg-[#0e1b2e] border rounded-xl p-4 flex items-start gap-3 ${accent ?? "border-[#1a2e48]"}`}>
      <div className="mt-0.5 text-slate-400">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{label}</p>
        <p className="text-xl font-black tabular leading-none">{value}</p>
        {sub && <p className="text-[10px] text-slate-500 mt-1">{sub}</p>}
      </div>
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const [summary,  setSummary]  = useState<Summary | null>(null);
  const [open,     setOpen]     = useState<OpenTrade[]>([]);
  const [history,  setHistory]  = useState<ClosedTrade[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [closing,  setClosing]  = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [port, hist] = await Promise.all([
        fetch(`${BACKEND}/api/portfolio`).then(r => r.json()).catch(() => null),
        fetch(`${BACKEND}/api/portfolio/history?limit=100`).then(r => r.json()).catch(() => []),
      ]);
      if (port) { setSummary(port.summary); setOpen(port.open ?? []); }
      setHistory(Array.isArray(hist) ? hist : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const r = await fetch(`${BACKEND}/api/portfolio/refresh`, { method: "POST" });
      const d = await r.json();
      setSummary(d.summary);
      setOpen(d.open ?? []);
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

  const totalPnl = summary?.total_pnl_usd ?? 0;
  const equity   = summary?.equity ?? 10000;

  return (
    <div className="min-h-screen bg-[#070c18] text-white flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a2e48] bg-[#070c18]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-white hover:bg-[#111d30] border border-[#1a2e48] transition-all">
            <ArrowLeft size={12} /> Dashboard
          </Link>
          <div>
            <h1 className="text-sm font-bold text-white leading-none">Paper Portfolio</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">Trading virtuale — $1.000 per posizione</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#1a2e48] text-slate-300 bg-[#0d1829] hover:border-blue-500/40 hover:text-white transition-all disabled:opacity-50"
        >
          <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
          Controlla SL/TP
        </button>
      </header>

      <div className="flex-1 overflow-auto px-4 py-5 max-w-7xl mx-auto w-full flex flex-col gap-5">

        {/* ── Summary cards ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Equity"
            value={<span className={equity >= 10000 ? "text-emerald-400" : "text-red-400"}>${equity.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>}
            sub="partenza $10.000"
            icon={<DollarSign size={16} />}
            accent={equity >= 10000 ? "border-emerald-500/15" : "border-red-500/15"}
          />
          <StatCard
            label="P&L totale"
            value={<span className={totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}>{totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}</span>}
            sub={`${summary?.win_count ?? 0}W / ${summary?.loss_count ?? 0}L`}
            icon={<Activity size={16} />}
          />
          <StatCard
            label="Win rate"
            value={
              summary?.win_rate != null
                ? <span className={summary.win_rate >= 60 ? "text-emerald-400" : summary.win_rate >= 50 ? "text-amber-400" : "text-red-400"}>{summary.win_rate}%</span>
                : <span className="text-slate-500 text-base">—</span>
            }
            sub={`${summary?.closed_trades ?? 0} trade chiusi`}
            icon={<Target size={16} />}
          />
          <StatCard
            label="Posizioni aperte"
            value={<span className="text-amber-400">{summary?.open_trades ?? 0}</span>}
            sub="aggiornate ogni ora"
            icon={<Briefcase size={16} />}
            accent={(summary?.open_trades ?? 0) > 0 ? "border-amber-500/15" : "border-[#1a2e48]"}
          />
        </div>

        {/* ── Open positions ───────────────────────────────────────────────── */}
        <div className="bg-[#0e1b2e] border border-[#1a2e48] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1a2e48] flex items-center gap-2">
            <Clock size={13} className="text-amber-400" />
            <span className="text-xs font-bold text-slate-300">Posizioni Aperte</span>
            <span className="ml-auto text-[10px] text-slate-500">{open.length} trade</span>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-10 bg-[#1a2e48] rounded animate-pulse" />)}
            </div>
          ) : open.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Briefcase size={20} className="text-slate-700" />
              <p className="text-[11px] text-slate-500">Nessuna posizione aperta</p>
              <p className="text-[10px] text-slate-600">Le posizioni si aprono automaticamente sui segnali BUY/SELL</p>
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full border-collapse text-xs">
                <thead className="border-b border-[#1a2e48] bg-[#080f1e]">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Asset</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Dir.</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Entrata</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">SL</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">TP</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Aperta</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Chiudi</th>
                  </tr>
                </thead>
                <tbody>
                  {open.map(t => (
                    <tr key={t.id} className="border-b border-[#0d1829] hover:bg-[#111d30] transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-white text-[11px]">{shortSym(t.symbol)}</div>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
                          t.market === "crypto"
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}>{t.market}</span>
                      </td>
                      <td className="px-4 py-3"><DirectionBadge dir={t.direction} /></td>
                      <td className="px-4 py-3 text-right font-mono tabular text-slate-200 text-[11px]">{fmtPrice(t.entry_price)}</td>
                      <td className="px-4 py-3 text-right font-mono tabular text-red-400 text-[11px] hidden sm:table-cell">
                        {t.sl_price ? fmtPrice(t.sl_price) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular text-emerald-400 text-[11px] hidden sm:table-cell">
                        {t.tp_price ? fmtPrice(t.tp_price) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-[10px] text-slate-500 hidden md:table-cell">{fmtDate(t.open_time)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleClose(t.id)}
                          disabled={closing === t.id}
                          className="flex items-center gap-1 ml-auto px-2 py-1 rounded-md text-[10px] font-semibold border border-red-500/25 text-red-400 hover:border-red-500/50 hover:bg-red-500/8 transition-all disabled:opacity-40"
                        >
                          <X size={9} />
                          {closing === t.id ? "..." : "Chiudi"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Closed trades ────────────────────────────────────────────────── */}
        <div className="bg-[#0e1b2e] border border-[#1a2e48] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1a2e48] flex items-center gap-2">
            <CheckCircle2 size={13} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-300">Trade Chiusi</span>
            <span className="ml-auto text-[10px] text-slate-500">{history.length} trade</span>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-[#1a2e48] rounded animate-pulse" />)}
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <XCircle size={20} className="text-slate-700" />
              <p className="text-[11px] text-slate-500">Nessun trade chiuso ancora</p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[480px]">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 border-b border-[#1a2e48] bg-[#080f1e] z-10">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Asset</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Dir.</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Entrata → Uscita</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wide">P&amp;L $</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wide">P&amp;L %</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Motivo</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Chiuso</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(t => {
                    const won = t.pnl_usd > 0;
                    const reason = REASON_LABELS[t.close_reason] ?? { label: t.close_reason, color: "text-slate-400" };
                    return (
                      <tr key={t.id} className={`border-b border-[#0d1829] transition-colors ${won ? "hover:bg-emerald-500/[0.03]" : "hover:bg-red-500/[0.03]"}`}>
                        <td className="px-4 py-3">
                          <div className="font-bold text-white text-[11px]">{shortSym(t.symbol)}</div>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
                            t.market === "crypto"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          }`}>{t.market}</span>
                        </td>
                        <td className="px-4 py-3"><DirectionBadge dir={t.direction} /></td>
                        <td className="px-4 py-3 text-right hidden sm:table-cell">
                          <div className="text-[10px] font-mono tabular text-slate-400">{fmtPrice(t.entry_price)}</div>
                          <div className="text-[10px] font-mono tabular text-slate-200">→ {fmtPrice(t.close_price)}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-[11px] font-bold tabular ${won ? "text-emerald-400" : "text-red-400"}`}>
                            {won ? "+" : ""}${t.pnl_usd.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-[11px] font-bold tabular ${won ? "text-emerald-400" : "text-red-400"}`}>
                            {t.pnl_pct >= 0 ? "+" : ""}{t.pnl_pct.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className={`text-[10px] font-semibold ${reason.color}`}>{reason.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-[10px] text-slate-500 hidden lg:table-cell">{fmtDate(t.close_time)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
