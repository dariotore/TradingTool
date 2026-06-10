"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Activity, RefreshCw, LayoutGrid,
  TrendingUp, TrendingDown, Minus, ShieldAlert,
} from "lucide-react";
import { getBackend } from "@/lib/backend";

const BACKEND = getBackend();

type Mode = "crypto" | "forex";

interface AssetMeta {
  id: string;
  symbol: string;
  name: string;
  rank: number;
}

interface AssetData {
  price?: number;
  price_change_24h?: number;
  synthesis?: { recommendation: string; confidence: number };
}

const REC_STYLE: Record<string, {
  border: string; badge: string; label: string; bar: string; icon: React.ReactNode;
}> = {
  STRONG_BUY:  { border: "border-emerald-400/50", badge: "text-emerald-300 bg-emerald-500/15 border-emerald-400/30", label: "FORTE ↑", bar: "bg-emerald-400", icon: <TrendingUp  size={8} /> },
  BUY:         { border: "border-emerald-500/30", badge: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "COMPRA",  bar: "bg-emerald-500", icon: <TrendingUp  size={8} /> },
  SELL:        { border: "border-red-500/30",     badge: "text-red-400 bg-red-500/10 border-red-500/20",           label: "VENDI",   bar: "bg-red-500",     icon: <TrendingDown size={8} /> },
  STRONG_SELL: { border: "border-red-400/50",     badge: "text-red-300 bg-red-500/15 border-red-400/30",           label: "FORTE ↓", bar: "bg-red-400",     icon: <TrendingDown size={8} /> },
  HOLD:        { border: "border-amber-500/20",   badge: "text-amber-400 bg-amber-500/10 border-amber-500/20",     label: "ATTENDI", bar: "bg-amber-500",   icon: <Minus        size={8} /> },
  AVOID:       { border: "border-orange-500/20",  badge: "text-orange-400 bg-orange-500/10 border-orange-500/20",  label: "EVITA",   bar: "bg-orange-500",  icon: <ShieldAlert  size={8} /> },
};
const DEFAULT_STYLE = {
  border: "border-[#1a2e48]",
  badge:  "text-slate-500 bg-slate-500/8 border-slate-500/15",
  label:  "—", bar: "bg-slate-600",
  icon:   <Minus size={8} />,
};

function fmtPrice(v: number, isForex = false): string {
  if (!isForex) {
    if (v >= 1000) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    if (v >= 10)   return `$${v.toFixed(2)}`;
    if (v >= 1)    return `$${v.toFixed(3)}`;
    return `$${v.toFixed(6)}`;
  }
  if (v >= 100) return v.toFixed(2);
  if (v >= 1)   return v.toFixed(4);
  return v.toFixed(5);
}

function AssetCard({ asset, data, isForex, onClick }: {
  asset: AssetMeta;
  data: AssetData | undefined;
  isForex: boolean;
  onClick: () => void;
}) {
  const rec   = data?.synthesis?.recommendation ?? "";
  const conf  = data?.synthesis?.confidence     ?? 0;
  const price = data?.price;
  const ch    = data?.price_change_24h ?? null;
  const style = REC_STYLE[rec] ?? DEFAULT_STYLE;
  const loading = !data;

  return (
    <button
      onClick={onClick}
      className={`bg-[#0e1b2e] border rounded-xl p-3.5 text-left hover:brightness-110 active:scale-[.98] transition-all w-full ${style.border}`}
    >
      {/* Symbol + badge */}
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <div className="min-w-0">
          <div className="font-bold text-sm text-white leading-tight truncate">{asset.symbol}</div>
          <div className="text-[10px] text-[var(--text-3)] truncate mt-0.5 max-w-[110px] leading-tight">{asset.name}</div>
        </div>
        {rec && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border flex items-center gap-0.5 shrink-0 ${style.badge}`}>
            {style.icon}
            <span>{style.label}</span>
          </span>
        )}
      </div>

      {/* Price + change */}
      {loading ? (
        <div className="flex flex-col gap-1.5 mt-2 animate-pulse">
          <div className="h-3 w-3/4 bg-[#1a2e48] rounded" />
          <div className="h-2.5 w-1/2 bg-[#1a2e48] rounded" />
          <div className="h-1 w-full bg-[#1a2e48] rounded-full mt-1" />
        </div>
      ) : (
        <>
          <div className="text-sm font-mono font-bold text-white leading-tight tabular">
            {price != null ? fmtPrice(price, isForex) : <span className="text-[var(--text-3)]">—</span>}
          </div>
          <div className={`text-[10px] font-semibold mt-0.5 tabular ${ch != null ? (ch >= 0 ? "text-emerald-400" : "text-red-400") : "text-[var(--text-3)]"}`}>
            {ch != null ? `${ch >= 0 ? "▲" : "▼"} ${Math.abs(ch).toFixed(2)}%` : "—"}
          </div>

          {/* Confidence bar */}
          {rec && (
            <>
              <div className="mt-2 h-1 rounded-full bg-[#1a2e48] overflow-hidden">
                <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${Math.round(conf * 100)}%` }} />
              </div>
              <div className="text-[9px] text-[var(--text-3)] mt-0.5 tabular">{Math.round(conf * 100)}% conf.</div>
            </>
          )}
        </>
      )}
    </button>
  );
}

export default function OverviewPage() {
  const [mode, setMode]             = useState<Mode>("crypto");
  const [cryptoAssets, setCryptoAssets] = useState<AssetMeta[]>([]);
  const [forexAssets,  setForexAssets]  = useState<AssetMeta[]>([]);
  const [cryptoData,   setCryptoData]   = useState<Record<string, AssetData>>({});
  const [forexData,    setForexData]    = useState<Record<string, AssetData>>({});
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [lastUpdate,   setLastUpdate]   = useState<Date | null>(null);

  const assets  = mode === "forex" ? forexAssets  : cryptoAssets;
  const allData = mode === "forex" ? forexData     : cryptoData;
  const isForex = mode === "forex";

  const loadData = useCallback(async () => {
    try {
      const [coins, pairs, cd, fd] = await Promise.all([
        fetch(`${BACKEND}/api/coins`).then(r => r.json()).catch(() => []),
        fetch(`${BACKEND}/api/forex/pairs`).then(r => r.json()).catch(() => []),
        fetch(`${BACKEND}/api/data`).then(r => r.json()).catch(() => ({})),
        fetch(`${BACKEND}/api/forex/data`).then(r => r.json()).catch(() => ({})),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setCryptoAssets((coins as any[]).map(c => ({ id: c.binance_symbol, symbol: c.symbol, name: c.name, rank: c.market_cap_rank })));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setForexAssets((pairs as any[]).map(p => ({ id: p.id, symbol: `${p.base}/${p.quote}`, name: p.name, rank: p.rank })));
      setCryptoData(cd as Record<string, AssetData>);
      setForexData(fd  as Record<string, AssetData>);
      setLastUpdate(new Date());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    const endpoint = isForex ? "/api/forex/refresh" : "/api/refresh";
    try {
      await fetch(`${BACKEND}${endpoint}`, { method: "POST" });
      setTimeout(async () => { await loadData(); setRefreshing(false); }, 4000);
    } catch { setRefreshing(false); }
  }, [isForex, loadData, refreshing]);

  function handleSelect(id: string) {
    window.location.href = `/?id=${id}&market=${mode}`;
  }

  // Signal summary counters
  const counts = assets.reduce(
    (acc, a) => {
      const rec = allData[a.id]?.synthesis?.recommendation ?? "";
      if (rec.includes("BUY"))  acc.buy++;
      else if (rec.includes("SELL")) acc.sell++;
      else if (rec === "HOLD" || rec === "AVOID") acc.hold++;
      return acc;
    },
    { buy: 0, sell: 0, hold: 0 },
  );

  return (
    <div className="h-full bg-[#070c18] text-white flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a2e48] bg-[#070c18]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-[var(--text-2)] hover:text-white hover:bg-[#111d30] border border-[#1a2e48] transition-all"
          >
            ← Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <LayoutGrid size={14} className="text-[var(--text-3)]" />
            <span className="text-sm font-bold text-white">Overview</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Signal counters */}
          <div className="hidden sm:flex items-center gap-3">
            {counts.buy > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{counts.buy} BUY
              </span>
            )}
            {counts.sell > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />{counts.sell} SELL
              </span>
            )}
            {counts.hold > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{counts.hold} HOLD
              </span>
            )}
          </div>
          {lastUpdate && (
            <span className="text-[10px] text-[var(--text-3)] hidden sm:inline tabular">
              {lastUpdate.toLocaleTimeString("it-IT")}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#1a2e48] text-[var(--text-2)] bg-[#0d1829] hover:border-blue-500/40 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">{refreshing ? "Aggiornamento..." : "Aggiorna"}</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4 max-w-[1600px] mx-auto w-full space-y-4 pb-20 md:pb-6">

        {/* Mode tabs */}
        <div className="flex items-center gap-1 bg-[#0e1b2e] border border-[#1a2e48] p-1 rounded-lg self-start">
          {(["crypto", "forex"] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                mode === m
                  ? m === "crypto"
                    ? "bg-blue-600/90 text-white shadow-[0_0_12px_rgba(59,130,246,.3)]"
                    : "bg-emerald-600/90 text-white shadow-[0_0_12px_rgba(16,185,129,.3)]"
                  : "text-[var(--text-3)] hover:text-[var(--text-2)]"
              }`}
            >
              {m === "crypto" ? "₿ Crypto" : "€ Forex"}
            </button>
          ))}
        </div>

        {/* Asset grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="bg-[#0e1b2e] border border-[#1a2e48] rounded-xl h-28 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {assets.map(a => (
              <AssetCard
                key={a.id}
                asset={a}
                data={allData[a.id]}
                isForex={isForex}
                onClick={() => handleSelect(a.id)}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && assets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Activity size={28} className="text-[var(--text-3)]" />
            <p className="text-sm text-[var(--text-3)]">Nessun asset disponibile</p>
          </div>
        )}
      </div>
    </div>
  );
}
