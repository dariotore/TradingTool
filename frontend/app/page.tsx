"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  BarChart2, TrendingUp, Shield, Activity,
  Wifi, WifiOff, TrendingDown, Minus,
  RefreshCw, Clock, Menu, X, History, AlertTriangle,
  Bell, Users, LayoutGrid, Star, EyeOff, Eye,
  Briefcase, CalendarDays, BookOpen,
} from "lucide-react";
import AgentCard from "@/components/AgentCard";
import SynthesisPanel from "@/components/SynthesisPanel";
import PriceChart from "@/components/PriceChart";
import TextAnalysisPanel from "@/components/TextAnalysisPanel";
import NewsPanel from "@/components/NewsPanel";

import { getBackend } from "@/lib/backend";
const BACKEND       = getBackend();
const WS_URL        = BACKEND.replace(/^http/, "ws") + "/ws";
const API           = BACKEND;
const AUTO_REFRESH  = 60; // 1 minute

type Mode = "crypto" | "forex";

interface AssetMeta {
  id: string;           // binance_symbol for crypto, pair id for forex
  symbol: string;       // "BTC" or "EUR/USD"
  name: string;
  rank: number;
  price_change_24h: number | null;
}

type SymbolData = Record<string, unknown>;
type AllData    = Record<string, SymbolData>;
type Notif      = { id: number; symbol: string; action: string; confidence: number; ts: Date; market: string };

const REC_DOT: Record<string, string> = {
  STRONG_BUY: "bg-emerald-300 ring-1 ring-emerald-400/50",
  BUY:        "bg-emerald-400",
  SELL:       "bg-red-400",
  STRONG_SELL:"bg-red-300 ring-1 ring-red-400/50",
  HOLD:       "bg-amber-400",
  AVOID:      "bg-red-600",
};
const REC_TEXT: Record<string, string> = {
  STRONG_BUY: "text-emerald-300", BUY: "text-emerald-400",
  SELL:       "text-red-400",     STRONG_SELL: "text-red-300",
  HOLD:       "text-amber-400",   AVOID: "text-red-600",
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

function AssetList({ assets, allData, activeId, isForex, onSelect, onRefresh, refreshing,
  pinned, hidden, showHidden, onTogglePin, onToggleHide, onToggleShowHidden }: {
  assets: AssetMeta[];
  allData: AllData;
  activeId: string;
  isForex: boolean;
  onSelect: (id: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  pinned?: Set<string>;
  hidden?: Set<string>;
  showHidden?: boolean;
  onTogglePin?: (id: string) => void;
  onToggleHide?: (id: string) => void;
  onToggleShowHidden?: () => void;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (listRef.current) {
      const activeElement = listRef.current.querySelector("[data-active='true']") as HTMLElement;
      if (activeElement) activeElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeId]);

  const sortedAssets = useMemo(() => {
    const sorted = [...assets].sort((a, b) => {
      const pa = pinned?.has(a.id) ? 0 : hidden?.has(a.id) ? 2 : 1;
      const pb = pinned?.has(b.id) ? 0 : hidden?.has(b.id) ? 2 : 1;
      if (pa !== pb) return pa - pb;
      return a.rank - b.rank;
    });
    return showHidden ? sorted : sorted.filter(a => !hidden?.has(a.id));
  }, [assets, pinned, hidden, showHidden]);

  const hiddenCount = useMemo(() => assets.filter(a => hidden?.has(a.id)).length, [assets, hidden]);

  return (
    <div className="flex flex-col gap-0.5 px-1.5">
      {onRefresh && (
        <div className="flex justify-end px-2 pt-1.5 pb-0.5 shrink-0">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            title="Aggiorna"
            className={`p-1 rounded-md transition-all ${
              refreshing
                ? "text-[var(--text-3)] cursor-not-allowed"
                : "text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[#111d30]"
            }`}
          >
            <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      )}
      <div ref={listRef} className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
        {assets.length === 0
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 rounded-lg bg-[#0e1b2e] animate-pulse mx-1" />
            ))
          : sortedAssets.map(a => {
              const d        = allData[a.id] as { synthesis?: { recommendation?: string }; price?: number; price_change_24h?: number } | undefined;
              const isPinned = pinned?.has(a.id) ?? false;
              const isHidden = hidden?.has(a.id) ?? false;
              return (
                <div key={a.id} data-active={a.id === activeId ? "true" : "false"} className="relative group/wl">
                  {/* Pin accent bar */}
                  {isPinned && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-amber-400 rounded-r z-10" />}
                  <AssetRow
                    asset={a}
                    active={a.id === activeId}
                    synth={d?.synthesis}
                    price={d?.price}
                    change24h={d?.price_change_24h}
                    isForex={isForex}
                    onClick={() => onSelect(a.id)}
                  />
                  {/* Hover watchlist controls */}
                  {(onTogglePin || onToggleHide) && (
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/wl:opacity-100 flex items-center gap-0.5 z-20 bg-[#0e1b2e]/90 rounded px-0.5 transition-opacity">
                      {onTogglePin && (
                        <button
                          onClick={e => { e.stopPropagation(); onTogglePin(a.id); }}
                          title={isPinned ? "Rimuovi pin" : "Fissa in cima"}
                          className={`p-1 rounded hover:bg-[#1a2e48] transition-colors ${isPinned ? "text-amber-400" : "text-slate-600 hover:text-amber-400"}`}
                        >
                          <Star size={9} fill={isPinned ? "currentColor" : "none"} />
                        </button>
                      )}
                      {onToggleHide && !isHidden && (
                        <button
                          onClick={e => { e.stopPropagation(); onToggleHide(a.id); }}
                          title="Nascondi"
                          className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-[#1a2e48] transition-colors"
                        >
                          <EyeOff size={9} />
                        </button>
                      )}
                      {onToggleHide && isHidden && (
                        <button
                          onClick={e => { e.stopPropagation(); onToggleHide(a.id); }}
                          title="Mostra"
                          className="p-1 rounded text-red-400 hover:text-emerald-400 hover:bg-[#1a2e48] transition-colors"
                        >
                          <Eye size={9} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
        }
      </div>
      {/* Show-hidden toggle */}
      {hiddenCount > 0 && onToggleShowHidden && (
        <button
          onClick={onToggleShowHidden}
          className="mx-2 my-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] text-slate-500 hover:text-slate-300 border border-dashed border-[#1a2e48] hover:border-[#2a3e58] transition-colors"
        >
          {showHidden ? <EyeOff size={9} /> : <Eye size={9} />}
          {showHidden ? `Nascondi ${hiddenCount}` : `Mostra ${hiddenCount} nascosti`}
        </button>
      )}
    </div>
  );
}

const MODE_CONFIG: Record<Mode, { label: string; activeClass: string }> = {
  crypto: { label: "₿ Crypto", activeClass: "bg-blue-600/90 text-white shadow-[0_0_12px_rgba(59,130,246,.3)]" },
  forex:  { label: "€ Forex",  activeClass: "bg-emerald-600/90 text-white shadow-[0_0_12px_rgba(16,185,129,.3)]" },
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
  const [mode, setMode]                 = useState<Mode>("crypto");
  const [cryptoAssets, setCryptoAssets] = useState<AssetMeta[]>([]);
  const [forexAssets, setForexAssets]   = useState<AssetMeta[]>([]);
  const [activeId, setActiveId]         = useState<string>("");
  const [cryptoData, setCryptoData]     = useState<AllData>({});
  const [forexData, setForexData]       = useState<AllData>({});
  const [connected,   setConnected]   = useState(false);
  const [lastUpdate,  setLastUpdate]  = useState<Date | null>(null);
  const [refreshing,  setRefreshing]  = useState(false);
  const [countdown,   setCountdown]   = useState(AUTO_REFRESH);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [staleSeconds, setStaleSeconds] = useState(0);
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [notifOpen,      setNotifOpen]    = useState(false);
  const [notifEnabled,   setNotifEnabled] = useState(false);
  const [pinned,         setPinned]       = useState<Set<string>>(new Set());
  const [hidden,         setHidden]       = useState<Set<string>>(new Set());
  const [showHidden,     setShowHidden]   = useState(false);
  const prevRecsRef    = useRef<Record<string, string>>({});
  const notifIdCounter = useRef(0);
  const wsRef          = useRef<WebSocket | null>(null);
  const countdownRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const mainRef        = useRef<HTMLDivElement | null>(null);
  const refreshingRef  = useRef(false);

  const isForex = mode === "forex";
  const allData = isForex ? forexData : cryptoData;
  const assets  = isForex ? forexAssets : cryptoAssets;

  const resetCountdown = useCallback(() => setCountdown(AUTO_REFRESH), []);

  const detectChanges = useCallback((data: AllData, market: "crypto" | "forex") => {
    const fresh: Notif[] = [];
    for (const [symbol, d] of Object.entries(data)) {
      const synth = (d as Record<string, unknown>)?.synthesis as { recommendation?: string; confidence?: number } | undefined;
      const rec   = synth?.recommendation ?? "";
      const prev  = prevRecsRef.current[symbol] ?? "";
      if (["BUY", "STRONG_BUY", "SELL", "STRONG_SELL"].includes(rec) && rec !== prev) {
        fresh.push({ id: ++notifIdCounter.current, symbol, action: rec, confidence: synth?.confidence ?? 0, ts: new Date(), market });
      }
      prevRecsRef.current[symbol] = rec;
    }
    if (fresh.length === 0) return;
    setNotifications(prev => [...fresh.reverse(), ...prev].slice(0, 20));
    if ("Notification" in window && Notification.permission === "granted") {
      fresh.forEach(n => new Notification(`${n.symbol}: ${n.action}`, { body: `Conf. ${Math.round(n.confidence * 100)}%`, tag: n.symbol }));
    }
  }, []);

  const triggerRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    setRefreshing(true);
    refreshingRef.current = true;
    resetCountdown();
    const endpoint = isForex ? "/api/forex/refresh" : "/api/refresh";
    try {
      await fetch(`${API}${endpoint}`, { method: "POST" });
    } catch {
      setRefreshing(false);
      refreshingRef.current = false;
    }
  }, [resetCountdown, isForex]);

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
    const list = m === "forex" ? forexAssets : cryptoAssets;
    if (list.length > 0) setActiveId(list[0].id);
    setRefreshing(false);
    refreshingRef.current = false;
  }, [forexAssets, cryptoAssets]);

  // ── Load metadata ─────────────────────────────────────────────
  useEffect(() => {
    // `cancelled` prevents Strict-Mode double-invoke: the first mount is
    // cleaned up immediately in dev, so any in-flight callbacks must be
    // ignored — otherwise state updates fire twice and an extra WS
    // reconnect spawns a zombie socket alongside the live one.
    let cancelled = false;
    const abort   = new AbortController();
    const sig     = abort.signal;

    fetch(`${API}/api/coins`, { signal: sig })
      .then(r => r.json())
      .then((list: { binance_symbol: string; symbol: string; name: string; market_cap_rank: number; price_change_24h: number | null }[]) => {
        if (cancelled) return;
        const assets: AssetMeta[] = list.map(c => ({
          id: c.binance_symbol, symbol: c.symbol, name: c.name,
          rank: c.market_cap_rank, price_change_24h: c.price_change_24h,
        }));
        setCryptoAssets(assets);
        setActiveId(a => a || assets[0]?.id || "");
      })
      .catch(() => {});

    fetch(`${API}/api/forex/pairs`, { signal: sig })
      .then(r => r.json())
      .then((list: { id: string; base: string; quote: string; name: string; rank: number }[]) => {
        if (cancelled) return;
        const assets: AssetMeta[] = list.map(p => ({
          id: p.id, symbol: `${p.base}/${p.quote}`, name: p.name,
          rank: p.rank, price_change_24h: null,
        }));
        setForexAssets(assets);
      })
      .catch(() => {});

    fetch(`${API}/api/data`, { signal: sig })
      .then(r => r.json())
      .then((d: AllData) => { if (!cancelled && Object.keys(d).length > 0) setCryptoData(d); })
      .catch(() => {});

    fetch(`${API}/api/forex/data`, { signal: sig })
      .then(r => r.json())
      .then((d: AllData) => { if (!cancelled && Object.keys(d).length > 0) setForexData(d); })
      .catch(() => {});

    function connect() {
      if (cancelled) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen  = () => { if (!cancelled) setConnected(true); };
      ws.onclose = () => {
        if (!cancelled) setConnected(false);
        if (!cancelled) setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(e.data);
          if (["refreshing", "forex_refreshing"].includes(msg.type)) {
            setRefreshing(true);
          } else if (msg.type === "update") {
            detectChanges(msg.data as AllData, "crypto");
            refreshingRef.current = false;
            setCryptoData(msg.data); setLastUpdate(new Date()); setRefreshing(false); setCountdown(AUTO_REFRESH);
          } else if (msg.type === "forex_update") {
            detectChanges(msg.data as AllData, "forex");
            refreshingRef.current = false;
            setForexData(msg.data); setLastUpdate(new Date()); setRefreshing(false); setCountdown(AUTO_REFRESH);
          }
        } catch {}
      };
    }
    connect();
    return () => {
      cancelled = true;
      abort.abort();
      wsRef.current?.close();
    };
  }, [detectChanges]);

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

  // Stale-data tracker: count seconds since last successful update
  useEffect(() => {
    if (!lastUpdate) { setStaleSeconds(0); return; }
    const tick = () => setStaleSeconds(Math.floor((Date.now() - lastUpdate.getTime()) / 1000));
    tick();
    const t = setInterval(tick, 15_000);
    return () => clearInterval(t);
  }, [lastUpdate]);

  // Load watchlist from localStorage after mount
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem("wl_pinned") || "[]") as string[];
      const h = JSON.parse(localStorage.getItem("wl_hidden") || "[]") as string[];
      if (p.length) setPinned(new Set(p));
      if (h.length) setHidden(new Set(h));
    } catch {}
  }, []);

  const togglePin = useCallback((id: string) => {
    setPinned(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem("wl_pinned", JSON.stringify([...next]));
      return next;
    });
  }, []);

  const toggleHide = useCallback((id: string) => {
    setHidden(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem("wl_hidden", JSON.stringify([...next]));
      return next;
    });
  }, []);

  // URL param navigation (?id=...&market=...) from /overview page
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlId  = params.get("id");
    const urlMkt = params.get("market") as Mode | null;
    if (urlMkt === "crypto" || urlMkt === "forex") setMode(urlMkt);
    if (urlId) setActiveId(urlId);
    if ("Notification" in window) setNotifEnabled(Notification.permission === "granted");
  }, []);

  const activeAsset  = assets.find(a => a.id === activeId);
  const current        = allData[activeId] as { agents?: Record<string, SymbolData>; synthesis?: SymbolData; price?: number; price_change_24h?: number } | undefined;
  const agents         = current?.agents;
  const synthesis      = current?.synthesis;
  const currentPrice   = current?.price ?? null;
  const currentChange  = current?.price_change_24h ?? activeAsset?.price_change_24h ?? null;

  // Forex IDs are like "EURUSD" → yahoo symbol is "EURUSD=X"
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
            isForex
              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
              : "bg-blue-500/15 text-blue-400 border-blue-500/25"
          }`}>
            {isForex ? "FOREX" : "CRYPTO"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Overview link */}
          <Link
            href="/overview"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#1a2e48] text-[var(--text-2)] bg-[#0d1829] hover:border-blue-500/40 hover:text-white transition-all"
          >
            <LayoutGrid size={11} />
            Overview
          </Link>
          {/* History link */}
          <Link
            href="/history"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#1a2e48] text-[var(--text-2)] bg-[#0d1829] hover:border-blue-500/40 hover:text-white transition-all"
          >
            <History size={11} />
            Storico
          </Link>
          {/* Stats link */}
          <Link
            href="/stats"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#1a2e48] text-[var(--text-2)] bg-[#0d1829] hover:border-violet-500/40 hover:text-white transition-all"
          >
            <BarChart2 size={11} />
            Stats
          </Link>
          {/* Portfolio link */}
          <Link
            href="/portfolio"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#1a2e48] text-[var(--text-2)] bg-[#0d1829] hover:border-emerald-500/40 hover:text-white transition-all"
          >
            <Briefcase size={11} />
            Portfolio
          </Link>
          {/* Calendar link */}
          <Link
            href="/calendar"
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#1a2e48] text-[var(--text-2)] bg-[#0d1829] hover:border-amber-500/40 hover:text-white transition-all"
          >
            <CalendarDays size={11} />
            Calendario
          </Link>
          {/* Info link */}
          <Link
            href="/info"
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#1a2e48] text-[var(--text-2)] bg-[#0d1829] hover:border-sky-500/40 hover:text-white transition-all"
          >
            <BookOpen size={11} />
            Guida
          </Link>
          {/* Notification bell */}
          <button
            onClick={() => setNotifOpen(o => !o)}
            className="relative p-1.5 rounded-lg border border-[#1a2e48] text-[var(--text-3)] hover:text-white hover:bg-[#111d30] transition-all"
            title="Notifiche segnali"
          >
            <Bell size={13} />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-[8px] font-bold text-white flex items-center justify-center leading-none">
                {notifications.length > 9 ? "9+" : notifications.length}
              </span>
            )}
          </button>
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
              {refreshing ? "Aggiornamento..." : `Aggiorna ${isForex ? "Forex" : "Crypto"}`}
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
            <span className={`text-[10px] hidden lg:inline tabular ${staleSeconds > 300 ? "text-amber-400" : "text-[var(--text-3)]"}`}>
              {staleSeconds < 60
                ? "aggiornato ora"
                : staleSeconds < 3600
                  ? `${Math.floor(staleSeconds / 60)} min fa`
                  : lastUpdate.toLocaleTimeString("it-IT")}
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
              <AssetList assets={assets} allData={allData} activeId={activeId} isForex={isForex} onSelect={handleSelect} onRefresh={triggerRefresh} refreshing={refreshing}
                pinned={pinned} hidden={hidden} showHidden={showHidden}
                onTogglePin={togglePin} onToggleHide={toggleHide} onToggleShowHidden={() => setShowHidden(p => !p)} />
            </div>
          </aside>
        </div>
      )}

      {/* ── Notification dropdown ───────────────────────────────── */}
      {notifOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)}>
          <div
            className="absolute right-4 top-12 w-72 bg-[#0a1525] border border-[#1a2e48] rounded-xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a2e48]">
              <span className="text-xs font-bold text-white">Notifiche segnali</span>
              <div className="flex items-center gap-3">
                {!notifEnabled && (
                  <button
                    onClick={async () => {
                      const p = await Notification.requestPermission();
                      setNotifEnabled(p === "granted");
                    }}
                    className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Abilita push
                  </button>
                )}
                {notifications.length > 0 && (
                  <button onClick={() => setNotifications([])} className="text-[10px] text-[var(--text-3)] hover:text-white transition-colors">
                    Svuota
                  </button>
                )}
              </div>
            </div>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-1">
                <Bell size={16} className="text-[var(--text-3)]" />
                <span className="text-[11px] text-[var(--text-3)]">Nessun segnale recente</span>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-[#0d1829]">
                {notifications.map(n => (
                  <button
                    key={n.id}
                    className="w-full px-4 py-2.5 hover:bg-[#111d30] transition-colors text-left"
                    onClick={() => {
                      setMode(n.market as Mode);
                      setActiveId(n.symbol);
                      setNotifOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${n.action.includes("BUY") ? "bg-emerald-400" : "bg-red-400"}`} />
                      <span className="font-bold text-xs text-white">{n.symbol}</span>
                      <span className={`text-[10px] font-semibold ${n.action.includes("BUY") ? "text-emerald-400" : "text-red-400"}`}>
                        {n.action.replace("_", " ")}
                      </span>
                      <span className="ml-auto text-[10px] text-[var(--text-3)] tabular shrink-0">{Math.round(n.confidence * 100)}%</span>
                    </div>
                    <div className="text-[9px] text-[var(--text-3)] mt-0.5 pl-3.5">
                      {n.ts.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                      {" · "}{n.market}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
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
            <AssetList assets={assets} allData={allData} activeId={activeId} isForex={isForex} onSelect={handleSelect} onRefresh={triggerRefresh} refreshing={refreshing}
              pinned={pinned} hidden={hidden} showHidden={showHidden}
              onTogglePin={togglePin} onToggleHide={toggleHide} onToggleShowHidden={() => setShowHidden(p => !p)} />
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
                      {isForex ? activeAsset?.symbol : `${activeId.replace("USDT", "")} / USDT`}
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

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto">
                {refreshing && (
                  <div className="mx-4 mt-4 flex items-center gap-2.5 px-4 py-2.5 bg-blue-500/8 border border-blue-500/20 rounded-xl text-xs text-blue-300">
                    <RefreshCw size={12} className="animate-spin shrink-0" />
                    <span>Analisi multi-agente in corso — potrebbe richiedere qualche secondo...</span>
                  </div>
                )}
                {!refreshing && staleSeconds > 300 && (
                  <div className="mx-4 mt-4 flex items-center gap-2.5 px-4 py-2.5 bg-amber-500/8 border border-amber-500/20 rounded-xl text-xs text-amber-300">
                    <AlertTriangle size={12} className="shrink-0" />
                    <span>
                      Dati non aggiornati da {Math.floor(staleSeconds / 60)} min
                      {connected ? " — il ciclo di analisi potrebbe essere bloccato." : " — connessione assente."}
                    </span>
                  </div>
                )}

                <div className="p-4 md:p-5 flex flex-col gap-4">

                  {/* Chart + Synthesis */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:items-stretch">
                    <div className="lg:col-span-2 bg-[#0e1b2e] border border-[#1a2e48] rounded-xl p-4 flex flex-col">
                      <PriceChart symbol={chartSymbol} source={isForex ? "forex" : "binance"} />
                    </div>
                    <SynthesisPanel
                      data={synthesis as unknown as Parameters<typeof SynthesisPanel>[0]["data"]}
                      symbol={activeId}
                      price={currentPrice}
                      isForex={isForex}
                    />
                  </div>

                  {/* Text analysis + News — 2 columns on large screens */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <TextAnalysisPanel
                      text={(synthesis as { text_analysis?: string } | undefined)?.text_analysis}
                      isForex={isForex}
                    />
                    <NewsPanel data={agents?.news as Parameters<typeof NewsPanel>[0]["data"]} />
                  </div>

                  {/* Agent cards */}
                  <div className={`grid gap-3 sm:gap-4 ${isForex ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4"}`}>
                    <AgentCard title="Fondamentale" agent="fundamental" data={agents?.fundamental ?? null} icon={<BarChart2 size={13} />} />
                    <AgentCard title="Tecnica"      agent="technical"   data={agents?.technical ?? null}   icon={<TrendingUp size={13} />} />
                    <AgentCard title="Rischio"      agent="risk"        data={agents?.risk ?? null}        icon={<Shield size={13} />} />
                    <AgentCard title="Notizie"      agent="news"        data={agents?.news ?? null}        icon={<Activity size={13} />} />
                    {isForex && <AgentCard title="COT" agent="cot" data={agents?.cot ?? null} icon={<Users size={13} />} />}
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
