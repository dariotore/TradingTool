"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  BarChart2, TrendingUp, Shield, Activity,
  Wifi, WifiOff, TrendingDown, Minus,
  RefreshCw, Clock, Menu, X,
} from "lucide-react";
import AgentCard from "@/components/AgentCard";
import SynthesisPanel from "@/components/SynthesisPanel";
import PriceChart from "@/components/PriceChart";
import TextAnalysisPanel from "@/components/TextAnalysisPanel";

const BACKEND       = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
const WS_URL        = BACKEND.replace(/^http/, "ws") + "/ws";
const API           = BACKEND;
const AUTO_REFRESH  = 60; // 1 minute

type Mode = "crypto" | "forex" | "commodity";

interface AssetMeta {
  id: string;           // binance_symbol for crypto, pair id for forex
  symbol: string;       // "BTC" or "EUR/USD"
  name: string;
  rank: number;
  price_change_24h: number | null;
}

type SymbolData = Record<string, unknown>;
type AllData    = Record<string, SymbolData>;

const REC_DOT: Record<string, string> = {
  BUY:  "bg-emerald-400", SELL: "bg-red-400",
  HOLD: "bg-amber-400",   AVOID: "bg-red-600",
};
const REC_TEXT: Record<string, string> = {
  BUY: "text-emerald-400", SELL: "text-red-400",
  HOLD: "text-amber-400",  AVOID: "text-red-600",
};

function fmtPrice(v: number, isForex = false): string {
  if (!isForex) {
    if (v >= 1000) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    if (v >= 10)   return `$${v.toFixed(2)}`;
    if (v >= 1)    return `$${v.toFixed(3)}`;
    if (v >= 0.01) return `$${v.toFixed(4)}`;
    return `$${v.toFixed(6)}`;
  }
  if (v >= 100)  return v.toFixed(2);
  if (v >= 1)    return v.toFixed(4);
  return v.toFixed(5);
}

function fmtCountdown(sec: number): string {
  return `${Math.floor(sec / 60).toString().padStart(2, "0")}:${(sec % 60).toString().padStart(2, "0")}`;
}

function AssetRow({ asset, active, synth, price, change24h, isForex, onClick }: {
  asset: AssetMeta;
  active: boolean;
  synth?: { recommendation?: string };
  price?: number | null;
  change24h?: number | null;
  isForex: boolean;
  onClick: () => void;
}) {
  const rec    = synth?.recommendation ?? "";
  const change = change24h ?? asset.price_change_24h;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left pl-3 pr-3 py-2 rounded-lg transition-all flex items-center gap-2.5 group relative ${
        active
          ? "bg-[#162338] border-l-2 border-blue-500 pl-2.5"
          : "border-l-2 border-transparent hover:bg-[#111d30] hover:border-l-2 hover:border-[#223050]"
      }`}
    >
      <span className="text-[10px] text-[var(--text-3)] w-4 shrink-0 tabular">{asset.rank}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`font-bold text-xs ${active ? "text-white" : "text-[var(--text-2)] group-hover:text-white"} transition-colors`}>
            {asset.symbol}
          </span>
          {rec && (
            <span className={`w-1.5 h-1.5 rounded-full ${REC_DOT[rec] ?? "bg-slate-400"}`} />
          )}
        </div>
        <div className="text-[10px] text-[var(--text-3)] truncate leading-tight">{asset.name}</div>
      </div>

      <div className="text-right shrink-0">
        <div className="text-[11px] font-mono font-semibold text-[var(--text-1)] tabular">
          {price != null ? fmtPrice(price, isForex) : <span className="text-[var(--text-3)]">—</span>}
        </div>
        {change !== null && change !== undefined ? (
          <div className={`text-[10px] tabular ${change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {change >= 0 ? "+" : ""}{Math.abs(change).toFixed(2)}%
          </div>
        ) : (
          <div className="text-[10px] text-[var(--text-3)]">—</div>
        )}
      </div>
    </button>
  );
}

function AssetList({ assets, allData, activeId, isForex, onSelect, onRefresh, refreshing }: {
  assets: AssetMeta[];
  allData: AllData;
  activeId: string;
  isForex: boolean;
  onSelect: (id: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Auto-scroll active item into view
    if (listRef.current) {
      const activeElement = listRef.current.querySelector("[data-active='true']") as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [activeId]);

  return (
    <div className="flex flex-col gap-0.5 px-1.5">
      <div className="flex items-center justify-between px-2 pt-2 pb-1.5 shrink-0">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-3)]">
          {isForex ? "Coppie Forex" : "Top 25 Crypto"}
        </span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            title={`Aggiorna ${isForex ? "Forex" : "Crypto"}`}
            className={`p-1 rounded-md transition-all ${
              refreshing
                ? "text-[var(--text-3)] cursor-not-allowed"
                : "text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[#111d30]"
            }`}
          >
            <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
          </button>
        )}
      </div>
      <div ref={listRef} className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
        {assets.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 rounded-lg bg-[#0e1b2e] animate-pulse mx-1" />
            ))
          : assets.map(a => {
              const d = allData[a.id] as { synthesis?: { recommendation?: string }; price?: number; price_change_24h?: number } | undefined;
              return (
                <div key={a.id} data-active={a.id === activeId ? "true" : "false"}>
                  <AssetRow
                    asset={a}
                    active={a.id === activeId}
                    synth={d?.synthesis}
                    price={d?.price}
                    change24h={d?.price_change_24h}
                    isForex={isForex}
                    onClick={() => onSelect(a.id)}
                  />
                </div>
              );
            })
        }
      </div>
    </div>
  );
}

const MODE_CONFIG: Record<Mode, { label: string; activeClass: string }> = {
  crypto:    { label: "₿ Crypto",  activeClass: "bg-blue-600/90 text-white shadow-[0_0_12px_rgba(59,130,246,.3)]" },
  forex:     { label: "€ Forex",   activeClass: "bg-emerald-600/90 text-white shadow-[0_0_12px_rgba(16,185,129,.3)]" },
  commodity: { label: "◆ Materie", activeClass: "bg-amber-600/90 text-white shadow-[0_0_12px_rgba(217,119,6,.3)]" },
};

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex items-center gap-1 p-2">
      {(Object.keys(MODE_CONFIG) as Mode[]).map(m => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-all ${
            mode === m
              ? MODE_CONFIG[m].activeClass
              : "text-[var(--text-3)] hover:text-[var(--text-2)] hover:bg-[#111d30]"
          }`}
        >
          {MODE_CONFIG[m].label}
        </button>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [mode, setMode]                     = useState<Mode>("crypto");
  const [cryptoAssets, setCryptoAssets]     = useState<AssetMeta[]>([]);
  const [forexAssets, setForexAssets]       = useState<AssetMeta[]>([]);
  const [commodityAssets, setCommodityAssets] = useState<AssetMeta[]>([]);
  const [activeId, setActiveId]             = useState<string>("");
  const [cryptoData, setCryptoData]         = useState<AllData>({});
  const [forexData, setForexData]           = useState<AllData>({});
  const [commodityData, setCommodityData]   = useState<AllData>({});
  const [connected, setConnected]   = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown]   = useState(AUTO_REFRESH);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const wsRef        = useRef<WebSocket | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mainRef      = useRef<HTMLDivElement | null>(null);

  const isForex     = mode === "forex";
  const isCommodity = mode === "commodity";
  const allData  = isCommodity ? commodityData : isForex ? forexData : cryptoData;
  const assets   = isCommodity ? commodityAssets : isForex ? forexAssets : cryptoAssets;

  const resetCountdown = useCallback(() => setCountdown(AUTO_REFRESH), []);

  const triggerRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    resetCountdown();
    const endpoint = isCommodity ? "/api/commodity/refresh" : isForex ? "/api/forex/refresh" : "/api/refresh";
    try {
      await fetch(`${API}${endpoint}`, { method: "POST" });
    } catch {
      setRefreshing(false);
    }
  }, [refreshing, resetCountdown, isForex, isCommodity]);

  const handleSelect = useCallback((id: string) => {
    setActiveId(id);
    setSidebarOpen(false);
    // Auto-scroll to top of main content
    setTimeout(() => {
      if (mainRef.current) {
        mainRef.current.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 50);
  }, []);

  const handleModeChange = useCallback((m: Mode) => {
    setMode(m);
    const list = m === "commodity" ? commodityAssets : m === "forex" ? forexAssets : cryptoAssets;
    if (list.length > 0) setActiveId(list[0].id);
    setRefreshing(false);
  }, [forexAssets, cryptoAssets, commodityAssets]);

  // ── Load metadata ─────────────────────────────────────────────
  useEffect(() => {
    // Crypto coins
    fetch(`${API}/api/coins`)
      .then(r => r.json())
      .then((list: { binance_symbol: string; symbol: string; name: string; market_cap_rank: number; price_change_24h: number | null }[]) => {
        const assets: AssetMeta[] = list.map(c => ({
          id: c.binance_symbol, symbol: c.symbol, name: c.name,
          rank: c.market_cap_rank, price_change_24h: c.price_change_24h,
        }));
        setCryptoAssets(assets);
        setActiveId(a => a || assets[0]?.id || "");
      })
      .catch(() => {});

    // Forex pairs
    fetch(`${API}/api/forex/pairs`)
      .then(r => r.json())
      .then((list: { id: string; base: string; quote: string; name: string; rank: number }[]) => {
        const assets: AssetMeta[] = list.map(p => ({
          id: p.id, symbol: `${p.base}/${p.quote}`, name: p.name,
          rank: p.rank, price_change_24h: null,
        }));
        setForexAssets(assets);
      })
      .catch(() => {});

    // Commodity list
    fetch(`${API}/api/commodity/list`)
      .then(r => r.json())
      .then((list: { id: string; symbol: string; name: string; rank: number }[]) => {
        const assets: AssetMeta[] = list.map(c => ({
          id: c.id, symbol: c.symbol, name: c.name,
          rank: c.rank, price_change_24h: null,
        }));
        setCommodityAssets(assets);
      })
      .catch(() => {});

    // Initial data
    fetch(`${API}/api/data`).then(r => r.json()).then((d: AllData) => { if (Object.keys(d).length > 0) setCryptoData(d); }).catch(() => {});
    fetch(`${API}/api/forex/data`).then(r => r.json()).then((d: AllData) => { if (Object.keys(d).length > 0) setForexData(d); }).catch(() => {});
    fetch(`${API}/api/commodity/data`).then(r => r.json()).then((d: AllData) => { if (Object.keys(d).length > 0) setCommodityData(d); }).catch(() => {});

    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => { setConnected(false); setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (["refreshing","forex_refreshing","commodity_refreshing"].includes(msg.type)) {
            setRefreshing(true);
          } else if (msg.type === "update") {
            setCryptoData(msg.data); setLastUpdate(new Date()); setRefreshing(false); setCountdown(AUTO_REFRESH);
          } else if (msg.type === "forex_update") {
            setForexData(msg.data); setLastUpdate(new Date()); setRefreshing(false); setCountdown(AUTO_REFRESH);
          } else if (msg.type === "commodity_update") {
            setCommodityData(msg.data); setLastUpdate(new Date()); setRefreshing(false); setCountdown(AUTO_REFRESH);
          }
        } catch {}
      };
    }
    connect();
    return () => wsRef.current?.close();
  }, []);

  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { triggerRefresh(); return AUTO_REFRESH; }
        return c - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [triggerRefresh]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  const activeAsset  = assets.find(a => a.id === activeId);
  const current        = allData[activeId] as { agents?: Record<string, SymbolData>; synthesis?: SymbolData; price?: number; price_change_24h?: number } | undefined;
  const agents         = current?.agents;
  const synthesis      = current?.synthesis;
  const currentPrice   = current?.price ?? null;
  const currentChange  = current?.price_change_24h ?? activeAsset?.price_change_24h ?? null;

  // Chart symbol: forex IDs are already like "EURUSD=X", commodity IDs like "GC=F"
  const chartSymbol = isForex ? activeId + "=X" : activeId;

  return (
    <div className="h-screen flex flex-col overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a2e48] bg-[#070c18]/80 backdrop-blur-sm shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            className="md:hidden p-1.5 rounded-lg text-[var(--text-3)] hover:text-white hover:bg-[#111d30] transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={18} />
          </button>
          {/* Logo */}
          <div className="hidden md:flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-[0_0_10px_rgba(59,130,246,.4)]">
              <Activity size={13} className="text-white" />
            </div>
            <span className="text-sm font-bold text-white tracking-tight">TradingPlatform</span>
          </div>
          <span className="md:hidden text-sm font-bold text-white">TradingPlatform</span>
          {/* Mobile mode pill */}
          <span className={`md:hidden text-[9px] font-bold px-2 py-0.5 rounded-full border ${
            isCommodity ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
            : isForex    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
            :              "bg-blue-500/15 text-blue-400 border-blue-500/25"
          }`}>
            {isCommodity ? "MATERIE" : isForex ? "FOREX" : "CRYPTO"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh */}
          <button
            onClick={triggerRefresh}
            disabled={refreshing}
            title="Aggiorna analisi"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              refreshing
                ? "border-blue-500/20 text-blue-400 bg-blue-500/8 cursor-not-allowed"
                : "border-[#1a2e48] text-[var(--text-2)] bg-[#0d1829] hover:border-blue-500/40 hover:text-white"
            }`}
          >
            <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">
              {refreshing ? "Aggiornamento..." : `Aggiorna ${isCommodity ? "Materie" : isForex ? "Forex" : "Crypto"}`}
            </span>
          </button>
          {/* Countdown */}
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-[var(--text-3)] tabular">
            <Clock size={10} className="shrink-0" />
            <span>{fmtCountdown(countdown)}</span>
          </div>
          {/* Status */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
            connected
              ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/8"
              : "border-red-500/20 text-red-400 bg-red-500/8"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
            <span className="hidden sm:inline">{connected ? "Live" : "Offline"}</span>
          </div>
          {lastUpdate && (
            <span className="text-[10px] text-[var(--text-3)] hidden lg:inline tabular">
              {lastUpdate.toLocaleTimeString("it-IT")}
            </span>
          )}
        </div>
      </header>

      {/* ── Mobile drawer ───────────────────────────────────────── */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setSidebarOpen(false)}>
          <aside
            className="absolute left-0 top-0 bottom-0 w-64 sm:w-72 bg-[#070c18] border-r border-[#1a2e48] flex flex-col overflow-hidden animate-in slide-in-from-left duration-300"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a2e48] shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                  <Activity size={11} className="text-white" />
                </div>
                <span className="text-sm font-bold text-white">TradingPlatform</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg text-[var(--text-3)] hover:text-white hover:bg-[#111d30] transition-colors">
                <X size={15} />
              </button>
            </div>
            <ModeToggle mode={mode} onChange={handleModeChange} />
            <div className="flex-1 overflow-y-auto py-1">
              <AssetList assets={assets} allData={allData} activeId={activeId} isForex={isForex} onSelect={handleSelect} onRefresh={triggerRefresh} refreshing={refreshing} />
            </div>
          </aside>
        </div>
      )}

      {/* ── Body ────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden gap-3 p-3">

        {/* Desktop sidebar - 20% width, independently scrollable */}
        <aside className="hidden md:flex flex-col w-1/5 shrink-0 bg-[#0e1b2e] border border-[#1a2e48] rounded-xl overflow-hidden">
          <div className="shrink-0">
            <ModeToggle mode={mode} onChange={handleModeChange} />
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 py-1 px-1">
            <AssetList assets={assets} allData={allData} activeId={activeId} isForex={isForex} onSelect={handleSelect} onRefresh={triggerRefresh} refreshing={refreshing} />
          </div>
        </aside>

        {/* Main - 80% width, scrollable */}
        <main ref={mainRef} className="flex flex-col flex-1 w-full md:w-4/5 overflow-hidden bg-[#0e1b2e] border border-[#1a2e48] rounded-xl">
          {!activeId ? (
            <div className="flex items-center justify-center flex-1 text-[var(--text-3)] text-sm animate-pulse">
              Caricamento...
            </div>
          ) : (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Sticky header */}
              <div className="sticky top-0 z-20 bg-[#0e1b2e]/95 backdrop-blur-sm border-b border-[#1a2e48] px-4 md:px-5 py-3 shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-bold text-white text-base md:text-lg leading-none">{activeAsset?.name ?? activeId}</span>
                    <span className="text-xs text-[var(--text-3)]">
                      {isCommodity ? activeId : isForex ? activeAsset?.symbol : `${activeId.replace("USDT", "")} / USDT`}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg md:text-xl font-black font-mono text-white leading-none tabular">
                    {currentPrice != null ? fmtPrice(currentPrice, isForex) : "—"}
                  </div>
                  {currentChange != null && (
                    <div className={`text-xs font-bold mt-1 tabular ${currentChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {currentChange >= 0 ? "▲" : "▼"} {Math.abs(currentChange).toFixed(2)}%
                      <span className="text-[var(--text-3)] font-normal ml-1">24h</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

              {/* Refresh bar + Scrollable content */}
              <div className="flex-1 overflow-y-auto flex flex-col">
                {refreshing && (
                  <div className="mx-4 mt-4 flex items-center gap-2.5 px-4 py-2.5 bg-blue-500/8 border border-blue-500/20 rounded-xl text-xs text-blue-300 shrink-0">
                    <RefreshCw size={12} className="animate-spin shrink-0" />
                    <span>Analisi multi-agente in corso — potrebbe richiedere qualche secondo...</span>
                  </div>
                )}

              <div className="flex-1 p-4 md:p-5 flex flex-col gap-4 overflow-y-auto">

                {/* Chart + Synthesis */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Chart card */}
                  <div className="lg:col-span-2 bg-[#0e1b2e] border border-[#1a2e48] rounded-xl p-4">
                    <div className="mb-4">
                      <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-3)] mb-3">Grafico Prezzo</h3>
                    </div>
                    <PriceChart symbol={chartSymbol} source={isCommodity ? "commodity" : isForex ? "forex" : "binance"} />
                  </div>

                <SynthesisPanel
                  data={synthesis as Parameters<typeof SynthesisPanel>[0]["data"]}
                  symbol={activeId}
                  price={currentPrice}
                  isForex={isForex && !isCommodity}
                />
              </div>

                {/* Text analysis — full width */}
                <TextAnalysisPanel
                  text={(synthesis as { text_analysis?: string } | undefined)?.text_analysis}
                  isForex={isForex}
                />

                {/* Agent cards — 3 columns */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <AgentCard title="Fondamentale" agent="fundamental" data={agents?.fundamental ?? null} icon={<BarChart2 size={13} />} />
                  <AgentCard title="Tecnica"      agent="technical"   data={agents?.technical ?? null}   icon={<TrendingUp size={13} />} />
                  <AgentCard title="Rischio"      agent="risk"        data={agents?.risk ?? null}        icon={<Shield size={13} />} />
                </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
