"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, CalendarDays, AlertTriangle,
  Clock, ChevronLeft, ChevronRight,
} from "lucide-react";

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

type Week = "last" | "this" | "next";
const WEEKS: Week[] = ["last", "this", "next"];

// ── Helpers ───────────────────────────────────────────────────────────────────

const IMPACT_CFG = {
  High:   { label: "Alto",  dot: "bg-red-400",   bar: "bg-red-500",   bg: "bg-red-500/10",   text: "text-red-400",   border: "border-red-500/25"   },
  Medium: { label: "Medio", dot: "bg-amber-400", bar: "bg-amber-400", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/25" },
  Low:    { label: "Basso", dot: "bg-slate-600", bar: "bg-slate-600", bg: "bg-slate-500/8",  text: "text-slate-500", border: "border-slate-500/20" },
} as const;

const COUNTRY_CFG: Record<string, { flag: string; color: string }> = {
  USD: { flag: "🇺🇸", color: "text-blue-400"    },
  EUR: { flag: "🇪🇺", color: "text-emerald-400" },
  GBP: { flag: "🇬🇧", color: "text-purple-400"  },
  JPY: { flag: "🇯🇵", color: "text-red-400"     },
  CHF: { flag: "🇨🇭", color: "text-slate-200"   },
  AUD: { flag: "🇦🇺", color: "text-amber-400"   },
  NZD: { flag: "🇳🇿", color: "text-sky-400"     },
  CAD: { flag: "🇨🇦", color: "text-rose-400"    },
  CNY: { flag: "🇨🇳", color: "text-red-300"     },
};

const KEY_CURRENCIES = new Set(Object.keys(COUNTRY_CFG));

function fmt(isoDate: string, opts: Intl.DateTimeFormatOptions): string {
  try { return new Date(isoDate).toLocaleString("it-IT", { timeZone: "Europe/Rome", ...opts }); }
  catch { return "—"; }
}

function dayKey(isoDate: string): string {
  try {
    const tz = new Date(new Date(isoDate).toLocaleString("en-US", { timeZone: "Europe/Rome" }));
    return `${tz.getFullYear()}-${String(tz.getMonth()+1).padStart(2,"0")}-${String(tz.getDate()).padStart(2,"0")}`;
  } catch { return isoDate.slice(0, 10); }
}

function todayKey(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`;
}

function tomorrowKey(): string {
  const t = new Date(); t.setDate(t.getDate() + 1);
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
}

function tryParseNum(s: string | null): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(",", ".").replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [events,  setEvents]  = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const [week,    setWeek]    = useState<Week>("this");
  const [impact,  setImpact]  = useState<"all" | "High" | "Medium">("all");

  const fetchEvents = useCallback(async (w: Week) => {
    setLoading(true); setError(false);
    try {
      const r = await fetch(`${BACKEND}/api/calendar?week=${w}`);
      if (!r.ok) throw new Error();
      const data = await r.json() as CalEvent[];
      setEvents(Array.isArray(data) ? data : []);
    } catch { setError(true); }
    finally   { setLoading(false); }
  }, []);

  useEffect(() => { fetchEvents(week); }, [week, fetchEvents]);

  const filtered = useMemo(() => events.filter(e =>
    KEY_CURRENCIES.has(e.country) &&
    (impact === "all" || e.impact === impact)
  ), [events, impact]);

  const today    = todayKey();
  const tomorrow = tomorrowKey();

  const grouped = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of filtered) {
      const k = dayKey(ev.date);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(ev);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, evs]) => ({
        key, isToday: key === today, isTomorrow: key === tomorrow,
        label: fmt(evs[0].date, { weekday: "long", day: "numeric", month: "long" }),
        events: [...evs].sort((a, b) => a.date.localeCompare(b.date)),
      }));
  }, [filtered, today, tomorrow]);

  const weekIdx  = WEEKS.indexOf(week);
  const highCount = useMemo(() => filtered.filter(e => e.impact === "High").length, [filtered]);

  return (
    <div className="min-h-screen bg-[#070c18] text-white flex flex-col">

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#1a2e48] bg-[#070c18]/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-white hover:bg-[#111d30] border border-[#1a2e48] transition-all">
            <ArrowLeft size={12} /> Dashboard
          </Link>
          <div>
            <h1 className="text-sm font-bold text-white leading-none">Calendario Economico</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">Orari CET · Forex Factory</p>
          </div>
        </div>
        <button
          onClick={() => fetchEvents(week)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#1a2e48] text-slate-300 bg-[#0d1829] hover:border-blue-500/40 hover:text-white transition-all disabled:opacity-50"
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          <span className="hidden sm:inline">Aggiorna</span>
        </button>
      </header>

      <div className="flex-1 overflow-auto px-3 sm:px-4 py-4 max-w-5xl mx-auto w-full flex flex-col gap-4 pb-20 md:pb-6">

        {/* Week navigation */}
        <div className="flex items-center justify-between bg-[#0e1b2e] border border-[#1a2e48] rounded-xl px-3 py-2">
          <button
            onClick={() => setWeek(WEEKS[weekIdx - 1])}
            disabled={weekIdx === 0 || loading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-white hover:bg-[#1a2e48] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={13} /> <span className="hidden xs:inline">Prec.</span>
          </button>

          <div className="flex items-center gap-1.5">
            {WEEKS.map((w) => (
              <button
                key={w}
                onClick={() => setWeek(w)}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all ${
                  week === w
                    ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                    : "text-slate-500 border-transparent hover:text-slate-300 hover:border-[#1a2e48]"
                }`}
              >
                {w === "last" ? "Scorsa" : w === "this" ? "Corrente" : "Prossima"}
              </button>
            ))}
          </div>

          <button
            onClick={() => setWeek(WEEKS[weekIdx + 1])}
            disabled={weekIdx === WEEKS.length - 1 || loading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-white hover:bg-[#1a2e48] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span className="hidden xs:inline">Prox.</span> <ChevronRight size={13} />
          </button>
        </div>

        {/* Filters + summary */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            {(["all", "High", "Medium"] as const).map(i => (
              <button
                key={i}
                onClick={() => setImpact(i)}
                className={`text-[10px] font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                  impact === i
                    ? i === "High"   ? "bg-red-500/15 text-red-400 border-red-500/30"
                    : i === "Medium" ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                    : "bg-blue-500/15 text-blue-400 border-blue-500/30"
                    : "text-slate-500 border-[#1a2e48] hover:text-slate-300"
                }`}
              >
                {i === "all" ? "Tutti" : i === "High" ? "🔴 Alto" : "🟡 Medio"}
              </button>
            ))}
          </div>
          {!loading && !error && (
            <span className="text-[10px] text-slate-600">
              {filtered.length} eventi
              {highCount > 0 && <span className="text-red-400/70"> · {highCount} alto impatto</span>}
            </span>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-[#0e1b2e] border border-[#1a2e48] rounded-xl p-4 space-y-2 animate-pulse">
                <div className="h-4 w-40 bg-[#1a2e48] rounded" />
                {[1, 2, 3].map(j => <div key={j} className="h-14 bg-[#1a2e48] rounded" />)}
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <AlertTriangle size={24} className="text-amber-400" />
            <p className="text-sm font-semibold text-slate-300">Impossibile caricare il calendario</p>
            <p className="text-xs text-slate-500 max-w-xs text-center">
              La fonte dati (Forex Factory) potrebbe non essere raggiungibile dalla VPS.
            </p>
            <button onClick={() => fetchEvents(week)}
              className="mt-2 px-4 py-2 rounded-lg text-xs font-semibold border border-[#1a2e48] text-slate-300 hover:text-white transition-all">
              Riprova
            </button>
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <CalendarDays size={24} className="text-slate-700" />
            <p className="text-sm text-slate-400">Nessun evento per questo filtro</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {grouped.map(day => (
              <div
                key={day.key}
                className={`border rounded-xl overflow-hidden ${
                  day.isToday ? "bg-[#0b1a30] border-blue-500/25" : "bg-[#0e1b2e] border-[#1a2e48]"
                }`}
              >
                {/* Day header */}
                <div className={`px-4 py-3 border-b flex items-center gap-2.5 ${day.isToday ? "border-blue-500/20 bg-blue-500/5" : "border-[#1a2e48]"}`}>
                  <CalendarDays size={12} className={day.isToday ? "text-blue-400" : "text-slate-500"} />
                  <span className={`text-xs font-bold capitalize ${day.isToday ? "text-blue-300" : "text-slate-200"}`}>
                    {day.label}
                  </span>
                  {day.isToday    && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">OGGI</span>}
                  {day.isTomorrow && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">DOMANI</span>}
                  <span className="ml-auto text-[10px] text-slate-600">{day.events.length} eventi</span>
                </div>

                {/* Events */}
                <div className="divide-y divide-[#0d1829]">
                  {day.events.map((ev, i) => {
                    const imp     = IMPACT_CFG[ev.impact as keyof typeof IMPACT_CFG] ?? IMPACT_CFG.Low;
                    const ctry    = COUNTRY_CFG[ev.country];
                    const hasAct  = !!ev.actual?.trim();
                    const actNum  = tryParseNum(ev.actual);
                    const foreNum = tryParseNum(ev.forecast);
                    const beat    = actNum !== null && foreNum !== null && actNum > foreNum;
                    const miss    = actNum !== null && foreNum !== null && actNum < foreNum;

                    return (
                      <div key={i} className="flex items-stretch hover:bg-[#111d30] transition-colors group">
                        {/* Impact bar */}
                        <div className={`w-0.5 shrink-0 ${imp.bar} opacity-60`} />

                        <div className="flex-1 px-3 sm:px-4 py-3 min-w-0">
                          {/* Main row: time + flag + title + values */}
                          <div className="flex items-start gap-2.5 sm:gap-3">
                            {/* Time */}
                            <div className="w-9 shrink-0 text-center pt-0.5">
                              <Clock size={9} className="text-slate-700 mx-auto mb-0.5" />
                              <span className="text-[10px] font-mono tabular text-slate-400 leading-none">
                                {fmt(ev.date, { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>

                            {/* Flag + currency */}
                            <div className="w-8 sm:w-10 shrink-0 text-center pt-0.5">
                              <div className="text-[14px] sm:text-[15px] leading-tight">{ctry?.flag ?? "🌐"}</div>
                              <span className={`text-[9px] font-bold leading-none ${ctry?.color ?? "text-slate-400"}`}>{ev.country}</span>
                            </div>

                            {/* Title + impact + values */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] sm:text-xs font-semibold text-slate-200 leading-snug">{ev.title}</p>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border inline-block mt-1 ${imp.bg} ${imp.text} ${imp.border}`}>
                                    {imp.label}
                                  </span>
                                </div>

                                {/* Values grid — always visible, responsive sizing */}
                                <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                                  {ev.previous && (
                                    <div className="text-right">
                                      <div className="text-[8px] sm:text-[9px] text-slate-600 mb-0.5">Prec.</div>
                                      <div className="text-[10px] sm:text-[11px] font-mono tabular text-slate-500">{ev.previous}</div>
                                    </div>
                                  )}
                                  {ev.forecast && (
                                    <div className="text-right">
                                      <div className="text-[8px] sm:text-[9px] text-slate-600 mb-0.5">Prev.</div>
                                      <div className="text-[10px] sm:text-[11px] font-mono tabular text-slate-300">{ev.forecast}</div>
                                    </div>
                                  )}
                                  <div className="text-right min-w-[44px]">
                                    <div className="text-[8px] sm:text-[9px] text-slate-600 mb-0.5">Attuale</div>
                                    {hasAct ? (
                                      <div className={`text-[11px] sm:text-[12px] font-bold font-mono tabular ${beat ? "text-emerald-400" : miss ? "text-red-400" : "text-white"}`}>
                                        {ev.actual}
                                        {beat && <span className="text-[8px] ml-0.5">▲</span>}
                                        {miss && <span className="text-[8px] ml-0.5">▼</span>}
                                      </div>
                                    ) : (
                                      <div className="text-[10px] text-slate-700">—</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
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
