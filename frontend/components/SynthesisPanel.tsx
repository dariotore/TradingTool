"use client";

import { TrendingUp, TrendingDown, Minus, ShieldAlert } from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
} from "recharts";

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
  learning_stats?: {
    accuracy?: number | null;
    sample_count?: number;
    regime?: string;
    multiplier?: number;
  };
}

const CFG: Record<string, {
  label: string; icon: React.ReactNode;
  text: string; bg: string; border: string; bar: string; glow: string;
}> = {
  STRONG_BUY:  { label: "FORTE ACQUISTO", icon: <TrendingUp  size={22} />, text: "text-emerald-300", bg: "bg-emerald-500/12", border: "border-emerald-400/50", bar: "bg-emerald-400", glow: "shadow-[0_0_36px_rgba(16,185,129,.22)]" },
  BUY:         { label: "COMPRA",         icon: <TrendingUp  size={22} />, text: "text-emerald-400", bg: "bg-emerald-500/8",  border: "border-emerald-500/25", bar: "bg-emerald-500", glow: "shadow-[0_0_24px_rgba(16,185,129,.12)]" },
  SELL:        { label: "VENDI",          icon: <TrendingDown size={22} />, text: "text-red-400",     bg: "bg-red-500/8",     border: "border-red-500/25",     bar: "bg-red-500",     glow: "shadow-[0_0_24px_rgba(239,68,68,.12)]"  },
  STRONG_SELL: { label: "FORTE VENDITA",  icon: <TrendingDown size={22} />, text: "text-red-300",     bg: "bg-red-500/12",    border: "border-red-400/50",     bar: "bg-red-400",     glow: "shadow-[0_0_36px_rgba(239,68,68,.22)]"  },
  HOLD:        { label: "ATTENDI",        icon: <Minus        size={22} />, text: "text-amber-400",   bg: "bg-amber-500/8",   border: "border-amber-500/25",   bar: "bg-amber-500",   glow: "" },
  AVOID:       { label: "EVITA",          icon: <ShieldAlert  size={22} />, text: "text-orange-400",  bg: "bg-orange-500/8",  border: "border-orange-500/25",  bar: "bg-orange-500",  glow: "" },
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

const RADAR_COLORS: Record<string, string> = {
  STRONG_BUY: "#6ee7b7", BUY: "#10b981",
  SELL: "#ef4444",       STRONG_SELL: "#fca5a5",
  HOLD: "#f59e0b",       AVOID: "#f97316",
};

const AGENT_LABELS: Record<string, string> = {
  fundamental: "Fond.", technical: "Tecnica",
  risk: "Rischio",      news: "News", cot: "COT",
};

function buildOperativeText(
  action: string,
  price: number,
  sl: number,
  tp: number,
  isForex: boolean,
): string {
  const fmt    = (v: number) => fmtP(v, isForex);
  const slPct  = Math.abs((price - sl) / price * 100).toFixed(1);
  const tpPct  = Math.abs((tp - price) / price * 100).toFixed(1);

  if (action === "BUY" || action === "STRONG_BUY")
    return `Considera un acquisto a ${fmt(price)}. Stop loss a ${fmt(sl)} (rischio −${slPct}%), take profit a ${fmt(tp)} (obiettivo +${tpPct}%).`;
  if (action === "SELL" || action === "STRONG_SELL")
    return `Considera una vendita a ${fmt(price)}. Stop loss a ${fmt(sl)} (+${slPct}%), take profit a ${fmt(tp)} (obiettivo −${tpPct}%).`;
  return "";
}

export default function SynthesisPanel({
  data, symbol, price, isForex = false,
}: {
  data: SynthesisData | null;
  symbol: string;
  price?: number | null;
  isForex?: boolean;
}) {
  // ── Skeleton ───────────────────────────────────────────────────────────────
  if (!data) {
    return (
      <div className="bg-[#0e1b2e] border border-[#1a2e48] rounded-xl p-5 flex flex-col gap-4 animate-pulse">
        {/* Action row */}
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-[#1a2e48]" />
          <div className="h-7 w-40 bg-[#1a2e48] rounded-lg" />
          <div className="ml-auto h-4 w-20 bg-[#1a2e48] rounded" />
        </div>
        {/* Confidence bar */}
        <div className="h-1.5 w-full bg-[#1a2e48] rounded-full" />
        {/* Agent dots */}
        <div className="flex items-center gap-4 flex-wrap">
          {[72, 60, 68, 76].map((w, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#1a2e48]" />
              <div className="h-2.5 bg-[#1a2e48] rounded" style={{ width: w }} />
            </div>
          ))}
        </div>
        {/* Divider + reasoning lines */}
        <div className="h-px bg-[#1a2e48]" />
        <div className="flex flex-col gap-2">
          <div className="h-3 w-full bg-[#1a2e48] rounded" />
          <div className="h-3 w-4/5 bg-[#1a2e48] rounded" />
          <div className="h-3 w-3/5 bg-[#1a2e48] rounded" />
        </div>
        {/* Risk grid */}
        <div className="grid grid-cols-3 rounded-lg bg-[rgba(0,0,0,.2)] border border-[#1a2e48] divide-x divide-[#1a2e48]">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex flex-col items-center py-2.5 gap-1.5">
              <div className="h-2.5 w-14 bg-[#1a2e48] rounded" />
              <div className="h-3.5 w-16 bg-[#1a2e48] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Data ───────────────────────────────────────────────────────────────────
  const cfg         = CFG[data.recommendation] ?? CFG.HOLD;
  const confidence  = Math.round(data.confidence * 100);
  const rd          = data.risk_details ?? {};
  const ls          = data.learning_stats;
  const sampleCount = ls?.sample_count ?? 0;
  const accPct      = ls?.accuracy != null ? Math.round((ls.accuracy as number) * 100) : null;
  const hasAccuracy = accPct != null && sampleCount >= 10;
  const multBadge   = ls?.multiplier != null && ls.multiplier !== 1
    ? ls.multiplier > 1 ? "↑" : "↓"
    : null;

  const showOperative =
    ["BUY", "STRONG_BUY", "SELL", "STRONG_SELL"].includes(data.recommendation) &&
    rd.suggested_stop_loss != null &&
    rd.suggested_take_profit != null &&
    price != null;

  const operativeText = showOperative
    ? buildOperativeText(
        data.recommendation, price!, rd.suggested_stop_loss!, rd.suggested_take_profit!, isForex,
      )
    : "";

  return (
    <div className={`${cfg.bg} ${cfg.border} ${cfg.glow} border rounded-xl flex flex-col overflow-hidden`}>

      {/* ── Action ──────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4 flex items-center gap-2.5">
        <span className={cfg.text}>{cfg.icon}</span>
        <span className={`text-2xl font-black tracking-tight ${cfg.text}`}>{cfg.label}</span>
        <span className="text-xs text-[var(--text-3)] ml-auto">Confidenza</span>
        <span className={`text-sm font-bold tabular ${cfg.text}`}>{confidence}%</span>
      </div>

      {/* ── Confidence bar ──────────────────────────────────────── */}
      <div className="px-5 pb-4">
        <div className="h-1.5 rounded-full bg-[rgba(255,255,255,.06)] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${cfg.bar}`}
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>

      {/* ── Learning badge ──────────────────────────────────────── */}
      {ls && (
        <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-[var(--text-3)]">Storico segnali:</span>
          {hasAccuracy ? (
            <>
              <span className={`text-[11px] font-semibold tabular ${
                accPct! >= 60 ? "text-emerald-400" : accPct! >= 50 ? "text-amber-400" : "text-red-400"
              }`}>
                {accPct}% accuracy
              </span>
              <span className="text-[10px] text-[var(--text-3)]">
                ({sampleCount} segnali · {ls.regime})
              </span>
              {multBadge && (
                <span className={`text-[10px] font-bold ${multBadge === "↑" ? "text-emerald-400" : "text-amber-400"}`}>
                  {multBadge} conf. adattata
                </span>
              )}
            </>
          ) : sampleCount > 0 ? (
            <span className="text-[10px] text-amber-400/80">
              in apprendimento ({sampleCount}/10 segnali raccolti)
            </span>
          ) : (
            <span className="text-[10px] text-[var(--text-3)] italic">
              raccogliendo dati…
            </span>
          )}
        </div>
      )}

      {/* ── Radar chart agenti ──────────────────────────────────── */}
      {data.agent_scores && Object.keys(data.agent_scores).length >= 3 && (() => {
        const radarColor = RADAR_COLORS[data.recommendation] ?? "#64748b";
        const radarData  = Object.entries(data.agent_scores).map(([k, v]) => ({
          axis:  AGENT_LABELS[k] ?? k,
          value: Math.round(((v.score + 1) / 2) * 100),
        }));
        return (
          <div className="px-3 pb-1">
            <ResponsiveContainer width="100%" height={130}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="60%">
                <PolarGrid stroke="#1a3050" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: "#475569", fontSize: 9 }} />
                <Radar dataKey="value" stroke={radarColor} fill={radarColor} fillOpacity={0.18} strokeWidth={1.5} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        );
      })()}

      {/* ── Reasoning ───────────────────────────────────────────── */}
      <div className="px-5 pb-4 border-t border-[rgba(255,255,255,.05)] pt-3">
        <p className="text-xs text-[var(--text-2)] leading-relaxed">{data.reasoning}</p>
      </div>

      {/* ── Operative summary ───────────────────────────────────── */}
      {showOperative && operativeText && (
        <div className="mx-4 mb-3 px-3 py-2.5 rounded-lg bg-[rgba(0,0,0,.22)] border border-[rgba(255,255,255,.06)]">
          <p className="text-[9px] text-[var(--text-3)] uppercase tracking-widest mb-1">Operatività suggerita</p>
          <p className="text-[11px] text-[var(--text-2)] leading-relaxed">{operativeText}</p>
        </div>
      )}

      {/* ── Risk grid ───────────────────────────────────────────── */}
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
