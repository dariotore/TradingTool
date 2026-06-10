"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, TrendingUp, TrendingDown,
  Target, BarChart3, Activity, Zap, Brain,
  DollarSign, AlertTriangle, CheckCircle2,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartTooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

import { getBackend } from "@/lib/backend";
const BACKEND = getBackend();

// ── Types ─────────────────────────────────────────────────────────────────────

type AccuracyStat = {
  symbol: string; market: string; regime: string;
  total: number; correct: number; accuracy: number;
};

type AgentStat = {
  agent: string; signals_total: number;
  evaluated: number; correct: number; accuracy: number | null;
};

type BacktestResult = {
  total_trades: number; win_count: number; loss_count: number;
  win_rate_pct: number; profit_factor: number | null;
  avg_win_usd: number; avg_loss_usd: number;
  total_return_pct: number; sharpe_ratio: number;
  max_drawdown_pct: number; starting_equity: number; final_equity: number;
  equity_curve: { ts: string; equity: number }[];
  by_symbol: {
    symbol: string; market: string; trades: number; wins: number;
    win_rate: number; total_return_pct: number;
  }[];
  message?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function accColor(acc: number | null): string {
  if (acc === null) return "text-slate-500";
  if (acc >= 0.65) return "text-emerald-400";
  if (acc >= 0.55) return "text-amber-400";
  if (acc >= 0.45) return "text-orange-400";
  return "text-red-400";
}

function accLabel(acc: number | null): string {
  if (acc === null) return "—";
  return `${Math.round(acc * 100)}%`;
}

function shortSym(sym: string): string {
  return sym.replace("=X", "").replace("USDT", "").slice(0, 8);
}

function agentLabel(agent: string): string {
  const map: Record<string, string> = {
    fundamental: "Fondamentale",
    technical:   "Tecnico",
    news:        "Notizie",
    risk:        "Rischio",
    cot:         "COT",
  };
  return map[agent] ?? agent;
}

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
        {sub && <p className="text-[10px] text-slate-500 mt-1 leading-tight">{sub}</p>}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EquityTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const eq = payload[0]?.value as number;
  return (
    <div className="bg-[#0a1525] border border-[#1a3050] rounded-xl px-3 py-2 text-[11px] shadow-2xl">
      <p className="text-white font-bold">${eq.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
      <p className="text-slate-500 text-[9px] mt-0.5">{payload[0]?.payload?.ts?.slice(0, 10) ?? ""}</p>
    </div>
  );
}

function AccBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[10px] text-slate-600">dati insuff.</span>;
  const pct = Math.round(value * 100);
  const color = pct >= 65 ? "bg-emerald-500" : pct >= 55 ? "bg-amber-500" : pct >= 45 ? "bg-orange-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-[#1a2e48] overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[11px] font-bold tabular ${accColor(value)}`}>{pct}%</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const [accuracy,  setAccuracy]  = useState<AccuracyStat[]>([]);
  const [agents,    setAgents]    = useState<AgentStat[]>([]);
  const [backtest,  setBacktest]  = useState<BacktestResult | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [market,    setMarket]    = useState<"all" | "crypto" | "forex">("all");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [acc, ag, bt] = await Promise.all([
        fetch(`${BACKEND}/api/accuracy`).then(r => r.json()).catch(() => []),
        fetch(`${BACKEND}/api/agent-stats`).then(r => r.json()).catch(() => []),
        fetch(`${BACKEND}/api/backtest`).then(r => r.json()).catch(() => null),
      ]);
      setAccuracy(Array.isArray(acc) ? acc : []);
      setAgents(Array.isArray(ag) ? ag : []);
      setBacktest(bt && typeof bt === "object" && "total_trades" in bt ? bt : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredAcc = accuracy.filter(r => market === "all" || r.market === market);

  const bt = backtest;
  const equityCurve = bt?.equity_curve?.map(p => ({
    ts:     p.ts,
    equity: p.equity,
  })) ?? [];

  const totalReturn = bt?.total_return_pct ?? 0;
  const noData = !loading && (!bt || bt.total_trades === 0);

  return (
    <div className="h-full bg-[#070c18] text-white flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a2e48] bg-[#070c18]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-white hover:bg-[#111d30] border border-[#1a2e48] transition-all"
          >
            <ArrowLeft size={12} /> Dashboard
          </Link>
          <div>
            <h1 className="text-sm font-bold text-white leading-none">Learning &amp; Performance</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">Accuracy per agente e backtest segnali</p>
          </div>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#1a2e48] text-slate-300 bg-[#0d1829] hover:border-blue-500/40 hover:text-white transition-all disabled:opacity-50"
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          <span className="hidden sm:inline">Aggiorna</span>
        </button>
      </header>

      <div className="flex-1 overflow-auto px-4 py-5 max-w-7xl mx-auto w-full space-y-5 pb-20 md:pb-6">

        {/* ── Backtest KPI cards ──────────────────────────────────────────── */}
        {noData ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#111d30] border border-[#1a2e48] flex items-center justify-center">
              <Brain size={26} className="text-slate-600" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-300">Dati insufficienti</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Il sistema sta raccogliendo segnali. Le statistiche compariranno dopo i primi outcome (4h–24h).
              </p>
            </div>
          </div>
        ) : bt && bt.total_trades > 0 && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label="Trade totali"
                value={<span className="text-white">{bt.total_trades}</span>}
                sub={`${bt.win_count}W / ${bt.loss_count}L`}
                icon={<Activity size={16} />}
              />
              <StatCard
                label="Win rate"
                value={
                  <span className={bt.win_rate_pct >= 60 ? "text-emerald-400" : bt.win_rate_pct >= 50 ? "text-amber-400" : "text-red-400"}>
                    {bt.win_rate_pct}%
                  </span>
                }
                sub="segnali corretti 24h"
                icon={<Target size={16} />}
                accent={bt.win_rate_pct >= 60 ? "border-emerald-500/20" : "border-[#1a2e48]"}
              />
              <StatCard
                label="Profit factor"
                value={
                  bt.profit_factor !== null
                    ? <span className={bt.profit_factor >= 1.5 ? "text-emerald-400" : bt.profit_factor >= 1.0 ? "text-amber-400" : "text-red-400"}>
                        {bt.profit_factor}x
                      </span>
                    : <span className="text-slate-500 text-base">—</span>
                }
                sub="guadagni / perdite"
                icon={<DollarSign size={16} />}
              />
              <StatCard
                label="Rendimento totale"
                value={
                  <span className={totalReturn >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {totalReturn >= 0 ? "+" : ""}{totalReturn}%
                  </span>
                }
                sub={`da $${bt.starting_equity.toLocaleString()} → $${bt.final_equity.toLocaleString()}`}
                icon={totalReturn >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                accent={totalReturn >= 0 ? "border-emerald-500/15" : "border-red-500/15"}
              />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label="Sharpe ratio"
                value={
                  <span className={bt.sharpe_ratio >= 1 ? "text-emerald-400" : bt.sharpe_ratio >= 0 ? "text-amber-400" : "text-red-400"}>
                    {bt.sharpe_ratio}
                  </span>
                }
                sub="rendimento/rischio annualizzato"
                icon={<Zap size={16} />}
              />
              <StatCard
                label="Max drawdown"
                value={
                  <span className={bt.max_drawdown_pct <= 10 ? "text-emerald-400" : bt.max_drawdown_pct <= 20 ? "text-amber-400" : "text-red-400"}>
                    -{bt.max_drawdown_pct}%
                  </span>
                }
                sub="massima perdita dalla vetta"
                icon={<AlertTriangle size={16} />}
                accent={bt.max_drawdown_pct > 20 ? "border-red-500/15" : "border-[#1a2e48]"}
              />
              <StatCard
                label="Avg win"
                value={<span className="text-emerald-400">${bt.avg_win_usd}</span>}
                sub="guadagno medio per trade vincente"
                icon={<CheckCircle2 size={16} />}
              />
              <StatCard
                label="Avg loss"
                value={<span className="text-red-400">-${bt.avg_loss_usd}</span>}
                sub="perdita media per trade perdente"
                icon={<AlertTriangle size={16} />}
              />
            </div>

            {/* ── Equity curve ─────────────────────────────────────────────── */}
            {equityCurve.length > 1 && (
              <div className="bg-[#0e1b2e] border border-[#1a2e48] rounded-xl overflow-hidden">
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">Equity Curve (2% position size)</span>
                  <span className="text-[10px] text-slate-500">simulato su segnali reali</span>
                </div>
                <div className="px-2 pb-4">
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={equityCurve} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                      <defs>
                        <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={totalReturn >= 0 ? "#34d399" : "#f87171"} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={totalReturn >= 0 ? "#34d399" : "#f87171"} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a2e48" vertical={false} />
                      <XAxis dataKey="ts" hide />
                      <YAxis tick={{ fill: "#475569", fontSize: 8 }} tickLine={false} axisLine={false}
                        tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} />
                      <RechartTooltip content={<EquityTooltip />} cursor={{ stroke: "#1a3050" }} />
                      <Area
                        type="monotone" dataKey="equity" stroke={totalReturn >= 0 ? "#34d399" : "#f87171"}
                        strokeWidth={1.5} fill="url(#eqGrad)" dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Agent accuracy ───────────────────────────────────────────────── */}
        <div className="bg-[#0e1b2e] border border-[#1a2e48] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1a2e48] flex items-center gap-2">
            <Brain size={14} className="text-violet-400" />
            <span className="text-xs font-bold text-slate-300">Accuracy per Agente</span>
            <span className="text-[10px] text-slate-500 ml-1">(segnali direzionali vs. outcome 24h)</span>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="h-3 w-20 bg-[#1a2e48] rounded" />
                  <div className="h-1.5 w-32 bg-[#1a2e48] rounded-full" />
                  <div className="h-3 w-10 bg-[#1a2e48] rounded ml-auto" />
                </div>
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Brain size={20} className="text-slate-700" />
              <p className="text-[11px] text-slate-500">Nessun dato ancora — raccolto dopo i primi outcome</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead className="border-b border-[#1a2e48] bg-[#080f1e]">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Agente</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Accuracy 24h</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Corretti</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Valutati</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Totale</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map(ag => (
                    <tr key={ag.agent} className="border-b border-[#0d1829] hover:bg-[#111d30] transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-200">{agentLabel(ag.agent)}</span>
                        <span className="ml-1.5 text-[9px] text-slate-600 font-mono">{ag.agent}</span>
                      </td>
                      <td className="px-4 py-3"><AccBar value={ag.accuracy} /></td>
                      <td className="px-4 py-3 text-right tabular text-emerald-400 font-semibold">{ag.correct}</td>
                      <td className="px-4 py-3 text-right tabular text-slate-400">{ag.evaluated}</td>
                      <td className="px-4 py-3 text-right tabular text-slate-500">{ag.signals_total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Symbol accuracy ──────────────────────────────────────────────── */}
        <div className="bg-[#0e1b2e] border border-[#1a2e48] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1a2e48] flex items-center gap-3">
            <BarChart3 size={14} className="text-blue-400" />
            <span className="text-xs font-bold text-slate-300">Accuracy per Asset</span>
            <div className="ml-auto flex items-center gap-1">
              {(["all","crypto","forex"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMarket(m)}
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-md border transition-all ${
                    market === m
                      ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                      : "text-slate-500 border-transparent hover:border-[#1a2e48] hover:text-slate-300"
                  }`}
                >
                  {m === "all" ? "Tutti" : m === "crypto" ? "Crypto" : "Forex"}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="h-3 w-16 bg-[#1a2e48] rounded" />
                  <div className="h-1.5 w-28 bg-[#1a2e48] rounded-full" />
                  <div className="h-3 w-8 bg-[#1a2e48] rounded ml-auto" />
                </div>
              ))}
            </div>
          ) : filteredAcc.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <BarChart3 size={20} className="text-slate-700" />
              <p className="text-[11px] text-slate-500">Nessun dato ancora — min. 5 segnali valutati per asset</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead className="border-b border-[#1a2e48] bg-[#080f1e]">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Asset</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Regime</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Accuracy</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Corretti</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Totale</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAcc.map((r, i) => (
                    <tr key={i} className="border-b border-[#0d1829] hover:bg-[#111d30] transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-white text-[11px]">{shortSym(r.symbol)}</div>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
                          r.market === "crypto"
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}>
                          {r.market}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={`text-[10px] font-medium ${
                          r.regime === "trending" ? "text-blue-400" :
                          r.regime === "ranging"  ? "text-amber-400" : "text-slate-500"
                        }`}>{r.regime ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3"><AccBar value={r.accuracy} /></td>
                      <td className="px-4 py-3 text-right tabular text-emerald-400 font-semibold">{r.correct}</td>
                      <td className="px-4 py-3 text-right tabular text-slate-500">{r.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Per-symbol backtest breakdown ─────────────────────────────────── */}
        {bt && bt.by_symbol && bt.by_symbol.length > 0 && (
          <div className="bg-[#0e1b2e] border border-[#1a2e48] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1a2e48] flex items-center gap-2">
              <DollarSign size={14} className="text-emerald-400" />
              <span className="text-xs font-bold text-slate-300">Rendimento per Asset (backtest)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead className="border-b border-[#1a2e48] bg-[#080f1e]">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Asset</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Trade</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Win %</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Ritorno %</th>
                  </tr>
                </thead>
                <tbody>
                  {bt.by_symbol.map((s, i) => (
                    <tr key={i} className="border-b border-[#0d1829] hover:bg-[#111d30] transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-white text-[11px]">{shortSym(s.symbol)}</div>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
                          s.market === "crypto"
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}>{s.market}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular text-slate-400">{s.trades}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-[11px] font-bold tabular ${s.win_rate >= 60 ? "text-emerald-400" : s.win_rate >= 50 ? "text-amber-400" : "text-red-400"}`}>
                          {s.win_rate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-[11px] font-bold tabular ${s.total_return_pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {s.total_return_pct >= 0 ? "+" : ""}{s.total_return_pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
