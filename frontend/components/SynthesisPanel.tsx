"use client";

import { TrendingUp, TrendingDown, Minus, ShieldAlert } from "lucide-react";

interface SynthesisData {
  recommendation: string;
  confidence: number;
  reasoning: string;
  weighted_score: number;
  agent_scores: Record<string, { score: number; signal: string }>;
  risk_details?: {
    suggested_stop_loss?: number;
    suggested_take_profit?: number;
    position_size_pct?: number;
    risk_level?: string;
    volatility_daily_pct?: number | string;
  };
}

const CFG: Record<string, {
  label: string; icon: React.ReactNode;
  text: string; bg: string; border: string; bar: string; glow: string;
}> = {
  BUY:   { label: "COMPRA",  icon: <TrendingUp  size={22} />, text: "text-emerald-400", bg: "bg-emerald-500/8",  border: "border-emerald-500/25", bar: "bg-emerald-500", glow: "shadow-[0_0_24px_rgba(16,185,129,.12)]" },
  SELL:  { label: "VENDI",   icon: <TrendingDown size={22} />, text: "text-red-400",     bg: "bg-red-500/8",     border: "border-red-500/25",     bar: "bg-red-500",     glow: "shadow-[0_0_24px_rgba(239,68,68,.12)]"  },
  HOLD:  { label: "ATTENDI", icon: <Minus        size={22} />, text: "text-amber-400",   bg: "bg-amber-500/8",   border: "border-amber-500/25",   bar: "bg-amber-500",   glow: "" },
  AVOID: { label: "EVITA",   icon: <ShieldAlert  size={22} />, text: "text-orange-400",  bg: "bg-orange-500/8",  border: "border-orange-500/25",  bar: "bg-orange-500",  glow: "" },
};

function fmtP(v: number, isForex: boolean): string {
  if (isForex) return v >= 10 ? v.toFixed(3) : v.toFixed(5);
  if (v >= 1000) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (v >= 10)   return `$${v.toFixed(2)}`;
  if (v >= 1)    return `$${v.toFixed(3)}`;
  if (v >= 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(6)}`;
}

const SIG_COLORS: Record<string, string> = {
  BUY: "text-emerald-400", SELL: "text-red-400",
  NEUTRAL: "text-slate-400", ACCEPTABLE: "text-emerald-400",
  CAUTION: "text-amber-400", HIGH_RISK: "text-red-400",
};

export default function SynthesisPanel({
  data, symbol, price, isForex = false,
}: {
  data: SynthesisData | null;
  symbol: string;
  price?: number | null;
  isForex?: boolean;
}) {
  if (!data) {
    return (
      <div className="bg-[#0e1b2e] border border-[#1a2e48] rounded-xl p-5 flex flex-col gap-3 animate-pulse">
        <div className="h-8 w-32 bg-[#1a2e48] rounded-lg" />
        <div className="h-1.5 w-full bg-[#1a2e48] rounded-full" />
        <div className="h-4 w-3/4 bg-[#1a2e48] rounded" />
        <div className="h-4 w-1/2 bg-[#1a2e48] rounded" />
      </div>
    );
  }

  const cfg = CFG[data.recommendation] ?? CFG.HOLD;
  const confidence = Math.round(data.confidence * 100);
  const rd = data.risk_details ?? {};

  return (
    <div className={`${cfg.bg} ${cfg.border} ${cfg.glow} border rounded-xl flex flex-col overflow-hidden`}>

      {/* ── Top: action + price ─────────────────────── */}
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className={cfg.text}>{cfg.icon}</span>
            <span className={`text-2xl font-black tracking-tight ${cfg.text}`}>{cfg.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-3)]">Confidenza</span>
            <span className={`text-sm font-bold tabular ${cfg.text}`}>{confidence}%</span>
          </div>
        </div>
        {price != null && (
          <div className="text-right">
            <div className="text-[10px] text-[var(--text-3)] uppercase tracking-wider mb-0.5">
              {isForex ? "Tasso" : "Prezzo"}
            </div>
            <div className="text-xl font-bold text-white tabular font-mono leading-none">
              {fmtP(price, isForex)}
            </div>
          </div>
        )}
      </div>

      {/* ── Confidence bar ───────────────────────────── */}
      <div className="px-5 pb-4">
        <div className="h-1.5 rounded-full bg-[rgba(255,255,255,.06)] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${cfg.bar}`}
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>

      {/* ── Agent mini-signals ───────────────────────── */}
      {data.agent_scores && Object.keys(data.agent_scores).length > 0 && (
        <div className="px-5 pb-4 flex flex-wrap gap-x-4 gap-y-1">
          {Object.entries(data.agent_scores).map(([name, { signal }]) => (
            <div key={name} className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${SIG_COLORS[signal]?.replace("text-", "bg-") ?? "bg-slate-400"}`} />
              <span className="text-[10px] text-[var(--text-3)] capitalize">{name}</span>
              <span className={`text-[10px] font-semibold ${SIG_COLORS[signal] ?? "text-slate-400"}`}>{signal}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Reasoning ───────────────────────────────── */}
      <div className="px-5 pb-4 border-t border-[rgba(255,255,255,.05)] pt-3">
        <p className="text-xs text-[var(--text-2)] leading-relaxed">{data.reasoning}</p>
      </div>

      {/* ── Risk details ────────────────────────────── */}
      {(rd.suggested_stop_loss || rd.suggested_take_profit || rd.position_size_pct) && (
        <div className="mx-4 mb-4 grid grid-cols-3 rounded-lg bg-[rgba(0,0,0,.25)] border border-[#1a2e48] divide-x divide-[#1a2e48]">
          {rd.suggested_stop_loss && (
            <div className="flex flex-col items-center py-2.5 px-1">
              <span className="text-[10px] text-[var(--text-3)] mb-1">Stop Loss</span>
              <span className="text-xs font-bold text-red-400 tabular font-mono">{fmtP(rd.suggested_stop_loss, isForex)}</span>
            </div>
          )}
          {rd.suggested_take_profit && (
            <div className="flex flex-col items-center py-2.5 px-1">
              <span className="text-[10px] text-[var(--text-3)] mb-1">Take Profit</span>
              <span className="text-xs font-bold text-emerald-400 tabular font-mono">{fmtP(rd.suggested_take_profit, isForex)}</span>
            </div>
          )}
          {rd.position_size_pct && (
            <div className="flex flex-col items-center py-2.5 px-1">
              <span className="text-[10px] text-[var(--text-3)] mb-1">Size max</span>
              <span className="text-xs font-bold text-blue-400">{rd.position_size_pct}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
