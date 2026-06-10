"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import { getBackend } from "@/lib/backend";

interface Candle { ts: number; c: number; }

interface Timeframe {
  label: string;
  interval: string;
  limit: number;
  tickEvery: number;
  binanceInterval: string;
  formatTick: (ts: number) => string;
  formatTooltip: (ts: number) => string;
}

const TIMEFRAMES: Timeframe[] = [
  {
    label: "1H", interval: "1h", limit: 48, tickEvery: 8, binanceInterval: "1h",
    formatTick: ts => {
      const d = new Date(ts);
      return d.getHours() === 0
        ? d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })
        : d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    },
    formatTooltip: ts => new Date(ts).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
  },
  {
    label: "4H", interval: "4h", limit: 42, tickEvery: 6, binanceInterval: "4h",
    formatTick: ts => {
      const d = new Date(ts);
      return d.getHours() === 0
        ? d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })
        : d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    },
    formatTooltip: ts => new Date(ts).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
  },
  {
    label: "1D", interval: "1d", limit: 60, tickEvery: 10, binanceInterval: "1d",
    formatTick: ts => new Date(ts).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }),
    formatTooltip: ts => new Date(ts).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" }),
  },
  {
    label: "1S", interval: "1w", limit: 52, tickEvery: 8, binanceInterval: "1w",
    formatTick: ts => new Date(ts).toLocaleDateString("it-IT", { month: "short", year: "2-digit" }),
    formatTooltip: ts => {
      const d = new Date(ts);
      const e = new Date(ts + 7 * 864e5);
      return `Sett. ${d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })} – ${e.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })}`;
    },
  },
];

function fmtPrice(v: number): string {
  if (v >= 1000) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (v >= 10)   return `$${v.toFixed(2)}`;
  if (v >= 1)    return `$${v.toFixed(4)}`;
  return `$${v.toFixed(6)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, formatter, labelFormatter, color }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0a1525] border border-[#1a3050] rounded-xl px-3 py-2.5 shadow-2xl">
      <p className="text-[10px] text-[var(--text-3)] mb-1.5">{labelFormatter(label)}</p>
      <p className="text-sm font-bold tabular" style={{ color }}>
        {formatter(payload[0].value)[0]}
      </p>
    </div>
  );
}

export default function PriceChart({
  symbol,
  source = "binance",
}: {
  symbol: string;
  source?: "binance" | "forex" | "commodity";
}) {
  const [tfIndex, setTfIndex] = useState(0);
  const [data, setData]       = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);

  const tf = TIMEFRAMES[tfIndex];

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setData([]);

    let url: string;
    const backend = getBackend();
    if (source === "forex") {
      url = `${backend}/api/forex/ohlcv?symbol=${encodeURIComponent(symbol)}&interval=${tf.interval}&limit=${tf.limit}`;
    } else if (source === "commodity") {
      url = `${backend}/api/commodity/ohlcv?symbol=${encodeURIComponent(symbol)}&interval=${tf.interval}&limit=${tf.limit}`;
    } else {
      url = `${backend}/api/crypto/ohlcv?symbol=${symbol}&interval=${tf.binanceInterval}&limit=${tf.limit}`;
    }

    fetch(url)
      .then(r => r.json())
      .then((raw: unknown) => {
        if (!Array.isArray(raw)) return;
        if (source === "forex" || source === "commodity") {
          setData((raw as { ts: number; c: number }[]).map(k => ({ ts: k.ts, c: k.c })));
        } else {
          setData((raw as { t: number; c: number }[]).map(k => ({ ts: k.t, c: k.c })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [symbol, tf.interval, tf.limit, tf.binanceInterval, source]);

  const tickTs = data.filter((_, i) => i % tf.tickEvery === 0).map(d => d.ts);
  const first  = data[0]?.c ?? 0;
  const last   = data[data.length - 1]?.c ?? 0;
  const isUp   = last >= first;
  const color  = isUp ? "#22c55e" : "#ef4444";
  const gradId = `pcg-${symbol.replace(/[^a-z0-9]/gi, "")}`;
  const minP   = data.length ? Math.min(...data.map(d => d.c)) : 0;
  const maxP   = data.length ? Math.max(...data.map(d => d.c)) : 1;

  // change % label
  const changePct = first > 0 ? ((last - first) / first * 100) : null;

  return (
    <div className="flex flex-col gap-2.5 flex-1 min-h-[200px]">
      {/* Controls row */}
      <div className="flex items-center gap-1">
        {TIMEFRAMES.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setTfIndex(i)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
              i === tfIndex
                ? "bg-blue-600/25 text-blue-300 border border-blue-500/40"
                : "text-[var(--text-3)] hover:text-[var(--text-2)] border border-transparent hover:border-[#1a2e48]"
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {changePct !== null && (
            <span className={`text-[11px] font-bold tabular ${changePct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {changePct >= 0 ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
            </span>
          )}
          <span className="text-[10px] text-[var(--text-3)]">
            {tf.label === "1H" ? "48h" : tf.label === "4H" ? "7gg" : tf.label === "1D" ? "60gg" : "1 anno"}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col gap-2 pt-2">
          <div className="flex-1 shimmer rounded-lg" />
          <div className="h-3 w-full flex gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-1 shimmer rounded" />
            ))}
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-3)]">
          Dati non disponibili
        </div>
      ) : (
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={color} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 4" stroke="#1a2e48" vertical={false} />
              <XAxis
                dataKey="ts" type="number" scale="time"
                domain={["dataMin", "dataMax"]} ticks={tickTs}
                tickFormatter={tf.formatTick}
                tick={{ fill: "#3e5872", fontSize: 10 }} tickLine={false} axisLine={false}
              />
              <YAxis
                domain={[minP * 0.999, maxP * 1.001]} tickFormatter={fmtPrice}
                tick={{ fill: "#3e5872", fontSize: 10 }} tickLine={false} axisLine={false}
                width={70} tickCount={4}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    color={color}
                    formatter={(v: number) => [fmtPrice(v), "Chiusura"]}
                    labelFormatter={tf.formatTooltip}
                  />
                }
                cursor={{ stroke: color, strokeWidth: 1, strokeOpacity: 0.25 }}
              />
              <ReferenceLine y={first} stroke="#203860" strokeDasharray="4 4" strokeWidth={1} />
              <Area
                type="monotone" dataKey="c" dot={false}
                strokeWidth={2} stroke={color}
                fill={`url(#${gradId})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
