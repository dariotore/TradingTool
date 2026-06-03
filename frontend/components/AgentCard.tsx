"use client";

import { AlertTriangle } from "lucide-react";

interface AgentCardProps {
  title: string;
  agent: string;
  data: Record<string, unknown> | null;
  icon: React.ReactNode;
}

const SIGNAL_META: Record<string, { accent: string; badge: string; label: string }> = {
  BUY:       { accent: "card-accent-green", badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", label: "BUY"         },
  SELL:      { accent: "card-accent-red",   badge: "text-red-400   bg-red-500/10   border-red-500/30",         label: "SELL"        },
  NEUTRAL:   { accent: "card-accent-slate", badge: "text-slate-400 bg-slate-500/10 border-slate-500/30",       label: "NEUTRO"      },
  ACCEPTABLE:{ accent: "card-accent-green", badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", label: "OK"          },
  CAUTION:   { accent: "card-accent-amber", badge: "text-amber-400 bg-amber-500/10 border-amber-500/30",       label: "CAUTELA"     },
  HIGH_RISK: { accent: "card-accent-red",   badge: "text-red-400   bg-red-500/10   border-red-500/30",         label: "ALTO RISCHIO"},
};

function fmtVal(v: unknown): string {
  if (typeof v === "boolean")  return v ? "sì" : "no";
  if (typeof v === "number")   return v.toLocaleString("it-IT", { maximumFractionDigits: 3 });
  return String(v ?? "—");
}

function fmtLabel(k: string): string {
  return k.replace(/_/g, " ").replace(/\b\w/g, c => c);
}

export default function AgentCard({ title, data, icon }: AgentCardProps) {
  const score  = typeof data?.score === "number" ? data.score : 0;
  const signal = typeof data?.signal === "string" ? data.signal : "NEUTRAL";
  const details = (data?.details ?? {}) as Record<string, unknown>;
  const error  = data?.error as string | null;
  const meta   = SIGNAL_META[signal] ?? SIGNAL_META.NEUTRAL;

  /* score bar: map [-1,1] → [0,100%] */
  const pct   = Math.round(((score + 1) / 2) * 100);
  const barColor = score > 0.3 ? "bg-emerald-500" : score < -0.3 ? "bg-red-500" : "bg-amber-500";
  const scoreColor = score > 0 ? "text-emerald-400" : score < 0 ? "text-red-400" : "text-slate-400";

  /* pick up to 5 numeric/string detail rows */
  const rows = Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && !Array.isArray(v) && typeof v !== "object")
    .slice(0, 5);

  return (
    <div className={`bg-[#0e1b2e] border border-[#1a2e48] rounded-xl flex flex-col overflow-hidden ${meta.accent}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 text-[var(--text-2)] font-semibold text-xs uppercase tracking-wider">
          <span className="text-[var(--text-3)]">{icon}</span>
          {title}
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${meta.badge}`}>
          {meta.label}
        </span>
      </div>

      <div className="px-4 pb-4 flex flex-col gap-3 flex-1">
        {error ? (
          <div className="flex items-start gap-1.5 text-xs text-red-400 bg-red-500/5 rounded-lg p-2">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span className="leading-snug">{error.slice(0, 80)}</span>
          </div>
        ) : !data ? (
          /* Skeleton */
          <div className="flex flex-col gap-2 animate-pulse">
            {[40, 60, 50, 55, 45].map((w, i) => (
              <div key={i} className="h-2.5 rounded-full bg-[#1a2e48]" style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : (
          <>
            {/* Score bar */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wider">Score</span>
                <span className={`text-xs font-bold tabular ${scoreColor}`}>
                  {score > 0 ? "+" : ""}{score.toFixed(3)}
                </span>
              </div>
              <div className="relative h-1.5 rounded-full bg-[#1a2e48] overflow-hidden">
                <div className={`absolute top-0 bottom-0 rounded-full ${barColor}`} style={{ left: "50%", width: 0 }} />
                <div
                  className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* Data rows */}
            {rows.length > 0 && (
              <div className="flex flex-col gap-1.5 pt-0.5">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex items-baseline gap-1 min-w-0">
                    <span className="text-[11px] text-[var(--text-3)] truncate flex-1">{fmtLabel(k)}</span>
                    <span className="shrink-0 border-b border-dotted border-[#1a2e48] flex-grow mx-1" style={{ minWidth: 12 }} />
                    <span className="text-[11px] text-[var(--text-1)] tabular font-medium shrink-0">{fmtVal(v)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
