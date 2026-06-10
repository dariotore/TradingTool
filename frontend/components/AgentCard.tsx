"use client";

import { AlertTriangle, AlertCircle } from "lucide-react";
import InfoTooltip from "./InfoTooltip";

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

// Explanatory tooltips for known technical/risk metrics
const METRIC_TIPS: Record<string, string> = {
  rsi:                   "RSI: sopra 70 = ipercomprato (possibile correzione), sotto 30 = ipervenduto (possibile rimbalzo).",
  adx:                   "ADX: misura la forza del trend. Sopra 25 = trend forte, sotto 20 = mercato laterale.",
  stoch_k:               "Stocastico %K: sopra 80 = ipercomprato, sotto 20 = ipervenduto.",
  stoch_d:               "Stocastico %D: media mobile del %K. Usato per confermare i segnali.",
  macd_bullish:          "MACD sopra la linea di segnale indica momentum rialzista; sotto indica ribassista.",
  bb_position:           "Posizione nelle Bande di Bollinger. Near_upper = resistenza dinamica, near_lower = supporto.",
  volatility_daily_pct:  "Volatilità giornaliera del prezzo. Valori alti = rischio più elevato.",
  sharpe_ratio:          "Rendimento aggiustato per il rischio. Sopra 1 è buono, sopra 2 è ottimo.",
  sortino_ratio:         "Come lo Sharpe ma penalizza solo la volatilità al ribasso, non quella al rialzo.",
  max_drawdown_pct:      "Massima perdita dal picco nel periodo analizzato.",
  var_95_pct:            "VaR 95%: perdita massima attesa nel 95% dei giorni futuri.",
  kelly_pct:             "Dimensione suggerita della posizione secondo il criterio di Kelly (half-Kelly).",
  position_size_pct:     "Dimensione massima consigliata della posizione sul capitale totale.",
  market_structure:      "Struttura di mercato rilevata: uptrend (HH+HL), downtrend (LH+LL), ranging (laterale).",
  divergence:            "Divergenza RSI: il prezzo si muove in direzione opposta all'RSI — segnale di possibile inversione.",
  mtf_trend:             "Trend multi-timeframe (giornaliero). Conferma o contraddice il segnale orario.",
  ema50_bullish:         "Il prezzo è sopra l'EMA50 giornaliera: contesto rialzista sul medio termine.",
};

function fmtVal(v: unknown): string {
  if (typeof v === "boolean")  return v ? "sì" : "no";
  if (typeof v === "number")   return v.toLocaleString("it-IT", { maximumFractionDigits: 3 });
  return String(v ?? "—");
}

function fmtLabel(k: string): string {
  return k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export default function AgentCard({ title, data, icon }: AgentCardProps) {
  const score   = typeof data?.score  === "number" ? data.score  : 0;
  const signal  = typeof data?.signal === "string"  ? data.signal : "NEUTRAL";
  const details = (data?.details ?? {}) as Record<string, unknown>;
  const rawErr  = data?.error as string | null | undefined;
  const error   = rawErr && rawErr.trim().length > 0 ? rawErr : null;
  const meta    = SIGNAL_META[signal] ?? SIGNAL_META.NEUTRAL;

  const pct        = Math.round(((score + 1) / 2) * 100);
  const barGradient = score > 0.3
    ? "linear-gradient(90deg,#059669,#34d399)"
    : score < -0.3
    ? "linear-gradient(90deg,#dc2626,#f87171)"
    : "linear-gradient(90deg,#d97706,#fbbf24)";
  const scoreColor = score > 0 ? "text-emerald-400" : score < 0 ? "text-red-400" : "text-slate-400";

  const rows = Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && !Array.isArray(v) && typeof v !== "object")
    .slice(0, 5);

  const isPartial = data !== null && !error && rows.length === 0;

  return (
    <div className={`border border-[#1a2e48] hover:border-[#203860] rounded-xl flex flex-col overflow-hidden transition-all duration-200 ${meta.accent}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 text-[var(--text-2)] font-semibold text-xs uppercase tracking-wider">
          <span className="text-[var(--text-3)]">{icon}</span>
          {title}
        </div>
        <div className="flex items-center gap-1.5">
          {isPartial && (
            <span className="flex items-center gap-1 text-[9px] text-amber-400/80 bg-amber-500/8 border border-amber-500/20 px-1.5 py-0.5 rounded-md">
              <AlertCircle size={9} />
              Dati parziali
            </span>
          )}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${meta.badge}`}>
            {meta.label}
          </span>
        </div>
      </div>

      <div className="px-4 pb-4 flex flex-col gap-3 flex-1">
        {error ? (
          <div className="flex items-start gap-1.5 text-xs text-red-400 bg-red-500/5 rounded-lg p-2 border border-red-500/10">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span className="leading-snug">{error.slice(0, 100)}</span>
          </div>
        ) : !data ? (
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
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: barGradient }}
                />
              </div>
            </div>

            {/* Data rows */}
            {rows.length > 0 && (
              <div className="flex flex-col gap-1.5 pt-0.5">
                {rows.map(([k, v]) => (
                  <div key={k} className="flex items-center gap-1 min-w-0">
                    <span className="text-[11px] text-[var(--text-3)] truncate">
                      {fmtLabel(k)}
                    </span>
                    {METRIC_TIPS[k] && <InfoTooltip text={METRIC_TIPS[k]} />}
                    <span className="shrink-0 border-b border-dotted border-[#1a2e48] flex-grow mx-1" style={{ minWidth: 8 }} />
                    <span className="text-[11px] text-[var(--text-1)] tabular font-medium shrink-0">{fmtVal(v)}</span>
                  </div>
                ))}
              </div>
            )}

            {isPartial && (
              <p className="text-[10px] text-[var(--text-3)] italic">
                Dati dettagliati non disponibili per questo ciclo.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
