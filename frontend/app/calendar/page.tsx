"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, CalendarDays, AlertTriangle, Clock } from "lucide-react";

import { getBackend } from "@/lib/backend";
const BACKEND = getBackend();

// ── Types ─────────────────────────────────────────────────────────────────────

type CalEvent = {
  title:    string;
  country:  string;
  date:     string;
  impact:   string;
  forecast: string | null;
  previous: string | null;
  actual:   string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const IMPACT_CFG: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  High:   { label: "Alto",   dot: "bg-red-400",    bg: "bg-red-500/10",    text: "text-red-400",    border: "border-red-500/25"    },
  Medium: { label: "Medio",  dot: "bg-amber-400",  bg: "bg-amber-500/10",  text: "text-amber-400",  border: "border-amber-500/25"  },
  Low:    { label: "Basso",  dot: "bg-slate-500",  bg: "bg-slate-500/8",   text: "text-slate-500",  border: "border-slate-500/20"  },
};

const COUNTRY_CFG: Record<string, { flag: string; color: string }> = {
  USD: { flag: "🇺🇸", color: "text-blue-400"    },
  EUR: { flag: "🇪🇺", color: "text-emerald-400" },
  GBP: { flag: "🇬🇧", color: "text-purple-400"  },
  JPY: { flag: "🇯🇵", color: "text-red-400"     },
  CHF: { flag: "🇨🇭", color: "text-white"       },
  AUD: { flag: "🇦🇺", color: "text-amber-400"   },
  NZD: { flag: "🇳🇿", color: "text-sky-400"     },
  CAD: { flag: "🇨🇦", color: "text-rose-400"    },
};

const KEY_CURRENCIES = new Set(Object.keys(COUNTRY_CFG));

function formatEventTime(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
  } catch { return "—"; }
}

function formatDayHeader(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Rome" });
  } catch { return isoDate.slice(0, 10); }
}

function dayKey(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    const tz = new Date(d.toLocaleString("en-US", { timeZone: "Europe/Rome" }));
    return `${tz.getFullYear()}-${String(tz.getMonth()+1).padStart(2,"0")}-${String(tz.getDate()).padStart(2,"0")}`;
  } catch { return isoDate.slice(0, 10); }
}

function isToday(key: string): boolean {
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  return key === todayKey;
}

function isTomorrow(key: string): boolean {
  const t = new Date(); t.setDate(t.getDate() + 1);
  const tKey = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
  return key === tKey;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [events,   setEvents]   = useState<CalEvent[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);
  const [impact,   setImpact]   = useState<"all" | "High" | "Medium">("all");
  const [country,  setCountry]  = useState<string>("all");

  const fetchEvents = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const r = await fetch(`${BACKEND}/api/calendar`);
      if (!r.ok) throw new Error("fetch failed");
      const data = await r.json() as CalEvent[];
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const countries = useMemo(() => {
    const seen = new Set(events.map(e => e.country));
    return [...KEY_CURRENCIES].filter(c => seen.has(c));
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter(e => {
      if (impact !== "all"  && e.impact  !== impact)  return false;
      if (country !== "all" && e.country !== country) return false;
      if (!KEY_CURRENCIES.has(e.country)) return false;
      return true;
    });
  }, [events, impact, country]);

  // Group by day
  const grouped = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of filtered) {
      const key = dayKey(ev.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    // Sort days ascending, events within day ascending
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, evs]) => ({
        key,
        label: formatDayHeader(evs[0].date),
        today:    isToday(key),
        tomorrow: isTomorrow(key),
        events: [...evs].sort((a, b) => a.date.localeCompare(b.date)),
      }));
  }, [filtered]);

  return (
    <div className="min-h-screen bg-[#070c18] text-white flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a2e48] bg-[#070c18]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-white hover:bg-[#111d30] border border-[#1a2e48] transition-all">
            <ArrowLeft size={12} /> Dashboard
          </Link>
          <div>
            <h1 className="text-sm font-bold text-white leading-none">Calendario Economico</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">Settimana corrente · orari italiani (CET)</p>
          </div>
        </div>
        <button
          onClick={fetchEvents}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#1a2e48] text-slate-300 bg-[#0d1829] hover:border-blue-500/40 hover:text-white transition-all disabled:opacity-50"
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          <span className="hidden sm:inline">Aggiorna</span>
        </button>
      </header>

      <div className="flex-1 overflow-auto px-4 py-5 max-w-5xl mx-auto w-full flex flex-col gap-4">

        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Impact */}
          <div className="flex items-center gap-1">
            {(["all","High","Medium"] as const).map(i => (
              <button
                key={i}
                onClick={() => setImpact(i)}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-md border transition-all ${
                  impact === i
                    ? i === "High"   ? "bg-red-500/15 text-red-400 border-red-500/30"
                    : i === "Medium" ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                    : "bg-blue-500/15 text-blue-400 border-blue-500/30"
                    : "text-slate-500 border-transparent hover:border-[#1a2e48] hover:text-slate-300"
                }`}
              >
                {i === "all" ? "Tutti" : i === "High" ? "🔴 Alto" : "🟡 Medio"}
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-[#1a2e48]" />
          {/* Currency */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setCountry("all")}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-md border transition-all ${
                country === "all" ? "bg-blue-500/15 text-blue-400 border-blue-500/30" : "text-slate-500 border-transparent hover:border-[#1a2e48] hover:text-slate-300"
              }`}
            >Tutte</button>
            {countries.map(c => (
              <button
                key={c}
                onClick={() => setCountry(c)}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-md border transition-all ${
                  country === c
                    ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                    : "text-slate-500 border-transparent hover:border-[#1a2e48] hover:text-slate-300"
                }`}
              >
                {COUNTRY_CFG[c]?.flag ?? ""} {c}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1,2,3].map(i => (
              <div key={i} className="bg-[#0e1b2e] border border-[#1a2e48] rounded-xl p-4 space-y-2 animate-pulse">
                <div className="h-4 w-32 bg-[#1a2e48] rounded" />
                {[1,2].map(j => <div key={j} className="h-10 bg-[#1a2e48] rounded" />)}
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <AlertTriangle size={24} className="text-amber-400" />
            <p className="text-sm font-semibold text-slate-300">Impossibile caricare il calendario</p>
            <p className="text-xs text-slate-500 max-w-xs text-center">
              La fonte dati (Forex Factory) non è raggiungibile. Riprova tra qualche minuto.
            </p>
            <button onClick={fetchEvents} className="mt-2 px-4 py-2 rounded-lg text-xs font-semibold border border-[#1a2e48] text-slate-300 hover:text-white transition-all">
              Riprova
            </button>
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <CalendarDays size={24} className="text-slate-700" />
            <p className="text-sm font-semibold text-slate-400">Nessun evento per i filtri selezionati</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {grouped.map(day => (
              <div key={day.key} className="bg-[#0e1b2e] border border-[#1a2e48] rounded-xl overflow-hidden">
                {/* Day header */}
                <div className={`px-4 py-2.5 border-b border-[#1a2e48] flex items-center gap-2 ${day.today ? "bg-blue-500/8" : day.tomorrow ? "bg-amber-500/5" : ""}`}>
                  <CalendarDays size={12} className={day.today ? "text-blue-400" : "text-slate-500"} />
                  <span className={`text-xs font-bold capitalize ${day.today ? "text-blue-400" : "text-slate-300"}`}>
                    {day.label}
                  </span>
                  {day.today    && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">OGGI</span>}
                  {day.tomorrow && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">DOMANI</span>}
                  <span className="ml-auto text-[10px] text-slate-600">{day.events.length} eventi</span>
                </div>

                {/* Events */}
                <div className="divide-y divide-[#0d1829]">
                  {day.events.map((ev, i) => {
                    const imp  = IMPACT_CFG[ev.impact] ?? IMPACT_CFG.Low;
                    const ctry = COUNTRY_CFG[ev.country];
                    const hasActual = ev.actual && ev.actual.trim() !== "";
                    return (
                      <div key={i} className="px-4 py-3 flex items-center gap-3 hover:bg-[#111d30] transition-colors">
                        {/* Time */}
                        <div className="w-10 shrink-0 text-center">
                          <Clock size={10} className="text-slate-600 mx-auto mb-0.5" />
                          <span className="text-[10px] font-mono tabular text-slate-500">{formatEventTime(ev.date)}</span>
                        </div>

                        {/* Currency */}
                        <div className="w-10 shrink-0 text-center">
                          <div className="text-base leading-none">{ctry?.flag ?? "🌐"}</div>
                          <span className={`text-[9px] font-bold ${ctry?.color ?? "text-slate-400"}`}>{ev.country}</span>
                        </div>

                        {/* Impact dot */}
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${imp.dot}`} />

                        {/* Title */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-slate-200 leading-tight truncate">{ev.title}</p>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${imp.bg} ${imp.text} ${imp.border}`}>
                            {imp.label}
                          </span>
                        </div>

                        {/* Values */}
                        <div className="flex items-center gap-3 shrink-0 text-right">
                          {hasActual && (
                            <div>
                              <div className="text-[9px] text-slate-600">Attuale</div>
                              <div className="text-[11px] font-bold text-white tabular">{ev.actual}</div>
                            </div>
                          )}
                          {ev.forecast && (
                            <div className="hidden sm:block">
                              <div className="text-[9px] text-slate-600">Previsto</div>
                              <div className="text-[11px] tabular text-slate-300">{ev.forecast}</div>
                            </div>
                          )}
                          {ev.previous && (
                            <div className="hidden md:block">
                              <div className="text-[9px] text-slate-600">Precedente</div>
                              <div className="text-[11px] tabular text-slate-400">{ev.previous}</div>
                            </div>
                          )}
                          {!hasActual && !ev.forecast && !ev.previous && (
                            <span className="text-[10px] text-slate-600">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
