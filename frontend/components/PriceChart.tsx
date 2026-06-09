"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
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
    formatTick: ts => { const d = new Date(ts); return d.getHours() === 0 ? d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }) : d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }); },
    formatTooltip: ts => new Date(ts).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
  },
  {
    label: "4H", interval: "4h", limit: 42, tickEvery: 6, binanceInterval: "4h",
    formatTick: ts => { const d = new Date(ts); return d.getHours() === 0 ? d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }) : d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }); },
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
    formatTooltip: ts => { const d = new Date(ts); const e = new Date(ts + 7 * 864e5); return `Sett. ${d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })} – ${e.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })}`; },
  },
];

function fmtPrice(v: number): string {
  if (v >= 1000) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (v >= 10)   return `$${v.toFixed(2)}`;
  if (v >= 1)    return `$${v.toFixed(4)}`;
  return `$${v.toFixed(6)}`;
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
  const first = data[0]?.c ?? 0;
  const last  = data[data.length - 1]?.c ?? 0;
  const isUp  = last >= first;
  const color = isUp ? "#22c55e" : "#ef4444";
  const minP  = data.length ? Math.min(...data.map(d => d.c)) : 0;
  const maxP  = data.length ? Math.max(...data.map(d => d.c)) : 1;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1 items-center">
        {TIMEFRAMES.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setTfIndex(i)}
            className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${
              i === tfIndex
                ? "bg-blue-600/30 text-blue-300 border border-blue-500/40"
                : "text-gray-500 hover:text-gray-300 border border-transparent hover:border-[#374151]"
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-600 pr-1">
          {tf.label === "1H" ? "48h" : tf.label === "4H" ? "7gg" : tf.label === "1D" ? "60gg" : "1 anno"}
        </span>
      </div>

      {loading ? (
        <div className="h-44 flex items-center justify-center text-xs text-gray-500 animate-pulse">
          Caricamento grafico...
        </div>
      ) : (
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis
                dataKey="ts" type="number" scale="time"
                domain={["dataMin", "dataMax"]} ticks={tickTs}
                tickFormatter={tf.formatTick}
                tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false}
              />
              <YAxis
                domain={[minP * 0.999, maxP * 1.001]} tickFormatter={fmtPrice}
                tick={{ fill: "#6b7280", fontSize: 10 }} tickLine={false} axisLine={false}
                width={70} tickCount={4}
              />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #1f2937", fontSize: 11, borderRadius: 6 }}
                labelFormatter={(ts) => tf.formatTooltip(ts as number)}
                formatter={(v) => [fmtPrice(v as number), "Prezzo"]}
                cursor={{ stroke: "#374151", strokeWidth: 1 }}
              />
              <ReferenceLine y={first} stroke="#374151" strokeDasharray="4 4" strokeWidth={1} />
              <Line type="monotone" dataKey="c" dot={false} strokeWidth={2} stroke={color} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
