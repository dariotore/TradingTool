"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft, ChevronDown, RefreshCw,
  LayoutGrid, History, BarChart2, Briefcase, CalendarDays,
  TrendingUp, Shield, Activity, Newspaper, Brain,
  Star, EyeOff, Zap, BookOpen,
  TrendingDown, Minus, AlertTriangle, Info, CheckCircle2,
} from "lucide-react";

// ── Accordion (details/summary — no React state, no hydration issues) ─────────

function Section({
  icon, title, badge, children, defaultOpen = false,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group bg-[#0e1b2e] border border-[#1a2e48] rounded-xl"
    >
      <summary className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden hover:bg-[#111d30] rounded-xl transition-colors">
        <span className="text-blue-400 shrink-0">{icon}</span>
        <span className="flex-1 text-base font-bold text-white">{title}</span>
        {badge && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25 shrink-0">
            {badge}
          </span>
        )}
        <ChevronDown size={16} className="text-slate-500 shrink-0 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="px-5 pb-6 pt-2 border-t border-[#1a2e48] space-y-4">
        {children}
      </div>
    </details>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-300 leading-relaxed">{children}</p>;
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-5 mb-2 flex items-center gap-2">
      <span className="h-px flex-1 bg-[#1a2e48]" />
      {children}
      <span className="h-px flex-1 bg-[#1a2e48]" />
    </h3>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-blue-500/8 border border-blue-500/20 rounded-xl p-4 mt-2">
      <Info size={15} className="text-blue-400 shrink-0 mt-0.5" />
      <p className="text-sm text-blue-200 leading-relaxed">{children}</p>
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 bg-amber-500/8 border border-amber-500/20 rounded-xl p-4 mt-2">
      <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
      <p className="text-sm text-amber-200 leading-relaxed">{children}</p>
    </div>
  );
}

function SignalBadge({ rec }: { rec: string }) {
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    STRONG_BUY:  { bg: "bg-emerald-500/20", text: "text-emerald-300", label: "STRONG BUY"  },
    BUY:         { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "BUY"          },
    HOLD:        { bg: "bg-amber-500/15",   text: "text-amber-400",   label: "HOLD"         },
    AVOID:       { bg: "bg-red-900/25",     text: "text-red-500",     label: "AVOID"        },
    SELL:        { bg: "bg-red-500/15",     text: "text-red-400",     label: "SELL"         },
    STRONG_SELL: { bg: "bg-red-500/20",     text: "text-red-300",     label: "STRONG SELL"  },
  };
  const c = cfg[rec] ?? cfg.HOLD;
  return (
    <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-lg ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

function AgentRow({ icon, name, desc }: { icon: React.ReactNode; name: string; desc: string }) {
  return (
    <div className="flex items-start gap-4 py-3.5 border-b border-[#1a2e48] last:border-0">
      <div className="w-8 h-8 rounded-lg bg-[#0a1628] border border-[#1a2e48] flex items-center justify-center shrink-0 text-blue-400">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-200">{name}</p>
        <p className="text-sm text-slate-400 leading-relaxed mt-1">{desc}</p>
      </div>
    </div>
  );
}

function IndicatorRow({ name, short, desc }: { name: string; short: string; desc: string }) {
  return (
    <div className="py-3.5 border-b border-[#1a2e48] last:border-0">
      <div className="flex flex-wrap items-baseline gap-2 mb-1">
        <span className="text-sm font-bold text-white">{name}</span>
        <span className="text-xs text-slate-500 italic">{short}</span>
      </div>
      <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InfoPage() {
  return (
    <div className="h-full bg-[#070c18] text-white flex flex-col">

      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[#1a2e48] bg-[#070c18]/90 backdrop-blur-sm sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-[#111d30] border border-[#1a2e48] transition-all">
          <ArrowLeft size={13} /> Dashboard
        </Link>
        <div>
          <h1 className="text-sm font-bold text-white leading-none">Guida alla piattaforma</h1>
          <p className="text-xs text-slate-500 mt-0.5">Come funziona tutto — spiegato senza gergo tecnico</p>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-4 py-6 max-w-2xl mx-auto w-full space-y-4 pb-20 md:pb-8">

        {/* Intro card */}
        <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={18} className="text-blue-400" />
            <span className="text-base font-bold text-white">Benvenuto nella guida</span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            Questa piattaforma analizza automaticamente criptovalute e valute forex usando degli{" "}
            <strong className="text-white">agenti intelligenti</strong>. Non devi capire la finanza per
            usarla: ogni asset riceve un segnale semplice (<strong className="text-white">COMPRA / VENDI / ATTENDI</strong>)
            basato su centinaia di dati analizzati in automatico.
          </p>
          <Tip>
            Nessun segnale è una certezza. Usa sempre la tua testa e non investire mai più di quanto puoi permetterti di perdere.
          </Tip>
        </div>

        {/* ── PAGINE ── */}
        <SectionLabel>Le pagine</SectionLabel>

        <Section icon={<LayoutGrid size={16} />} title="Dashboard (pagina principale)" defaultOpen>
          <P>
            È la schermata principale dell&apos;app. A sinistra trovi la lista di tutti gli asset monitorati
            (crypto e forex). Cliccando su uno, a destra appaiono tutti i dettagli.
          </P>
          <H>Cosa vedi nella lista</H>
          <P>
            Ogni riga mostra il nome dell&apos;asset, il prezzo attuale, la variazione nelle ultime 24 ore
            e un pallino colorato con il segnale. Il sistema si aggiorna automaticamente ogni minuto.
          </P>
          <H>Segnali rapidi</H>
          <div className="flex flex-wrap gap-2 py-1">
            {["STRONG_BUY","BUY","HOLD","AVOID","SELL","STRONG_SELL"].map(r => <SignalBadge key={r} rec={r} />)}
          </div>
          <P>
            I segnali verdi (BUY / STRONG BUY) significano &quot;condizioni favorevoli all&apos;acquisto&quot;.
            I rossi (SELL / STRONG SELL) suggeriscono condizioni negative. Arancione (HOLD) = aspetta.
            Rosso scuro (AVOID) = rischio elevato, da evitare.
          </P>
          <H>Watchlist</H>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 bg-[#0a1628] rounded-lg border border-[#1a2e48]">
              <Star size={14} className="text-amber-400 shrink-0" />
              <span className="text-sm text-slate-300">Fissa in cima alla lista (preferiti)</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-[#0a1628] rounded-lg border border-[#1a2e48]">
              <EyeOff size={14} className="text-slate-500 shrink-0" />
              <span className="text-sm text-slate-300">Nascondi l&apos;asset (si ritrova in fondo alla lista)</span>
            </div>
          </div>
          <Tip>Le preferenze della watchlist vengono salvate nel browser e rimangono anche dopo aver chiuso la pagina.</Tip>
        </Section>

        <Section icon={<BarChart2 size={16} />} title="Pannello dettaglio asset">
          <P>
            Cliccando su un asset si apre il pannello di dettaglio con quattro schede:
          </P>
          <H>Le schede</H>
          <div className="space-y-3">
            {[
              ["Analisi", "Mostra i voti degli agenti (Tecnico, Fondamentale, Notizie, Rischio) e il segnale complessivo con il livello di confidenza."],
              ["Grafico", "Mostra l'andamento del prezzo con indicatori tecnici sovrapposti (EMA, Bande di Bollinger)."],
              ["Notizie", "Elenca le ultime notizie rilevanti per quell'asset, con un punteggio di sentiment."],
            ].map(([title, desc]) => (
              <div key={title} className="flex gap-3 p-3 bg-[#0a1628] rounded-lg border border-[#1a2e48]">
                <CheckCircle2 size={14} className="text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-slate-200">{title}</p>
                  <p className="text-sm text-slate-400 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <H>Livello di confidenza</H>
          <P>
            Ogni segnale ha una percentuale di confidenza (0–100%). Più è alta, più gli agenti sono
            &quot;d&apos;accordo&quot; tra loro. Sotto il 55% la situazione è incerta.
          </P>
        </Section>

        <Section icon={<History size={16} />} title="Storico segnali (/history)">
          <P>
            Registra ogni segnale emesso nel tempo, con data, asset, segnale e prezzo al momento dell&apos;emissione.
          </P>
          <H>Esito</H>
          <P>
            Dopo alcune ore il sistema controlla se il prezzo si è mosso nella direzione suggerita.
            Se un BUY è stato seguito da un rialzo, l&apos;esito è <strong className="text-emerald-400">✓ Corretto</strong>.
            Questi dati alimentano il sistema di apprendimento degli agenti.
          </P>
        </Section>

        <Section icon={<BarChart2 size={16} />} title="Statistiche (/stats)">
          <P>
            Mostra le performance storiche del sistema. Utile per capire quanto bene stanno
            funzionando gli agenti nel tempo.
          </P>
          <H>Metriche principali</H>
          <div className="space-y-3">
            {[
              ["Win Rate", "Percentuale di segnali corretti. Es: 65% = 65 segnali su 100 erano giusti."],
              ["Profit Factor", "Rapporto guadagni/perdite teorici. Sopra 1.0 = i segnali giusti pesano più di quelli sbagliati."],
              ["Sharpe Ratio", "Rendimento vs rischio. Sopra 1.0 è buono, sopra 2.0 è ottimo."],
              ["Max Drawdown", "La massima perdita consecutiva. Es: −12% = nel peggior momento il portafoglio aveva perso il 12%."],
            ].map(([label, desc]) => (
              <div key={label} className="flex gap-3 p-3 bg-[#0a1628] rounded-lg border border-[#1a2e48]">
                <div className="shrink-0 w-24 text-xs font-bold text-blue-400">{label}</div>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section icon={<Briefcase size={16} />} title="Portfolio simulato (/portfolio)">
          <P>
            Il <strong className="text-white">paper trading</strong> è una simulazione: il sistema apre
            e chiude posizioni fittizie di $1.000 senza usare denaro reale. Serve a vedere come avrebbe
            performato la strategia nella realtà.
          </P>
          <H>Apertura automatica</H>
          <P>
            Quando il segnale diventa BUY o SELL, il sistema registra una posizione con il prezzo corrente,
            uno Stop Loss (limite di perdita) e un Take Profit (obiettivo di guadagno).
          </P>
          <H>Quando si chiude un trade</H>
          <div className="space-y-2 mt-1">
            {[
              ["SL",      "Il prezzo raggiunge lo Stop Loss (limite di perdita)"],
              ["TP",      "Il prezzo raggiunge il Take Profit (obiettivo di guadagno)"],
              ["REVERSE", "Il segnale si inverte (da BUY a SELL o viceversa)"],
              ["SIGNAL",  "Il segnale torna a HOLD o AVOID"],
              ["MANUAL",  "Premi il pulsante Chiudi nella tabella"],
            ].map(([label, desc]) => (
              <div key={label} className="flex items-center gap-3 p-3 bg-[#0a1628] rounded-lg border border-[#1a2e48]">
                <span className="text-xs font-bold text-slate-300 bg-[#1a2e48] px-2 py-0.5 rounded w-16 text-center shrink-0">{label}</span>
                <span className="text-sm text-slate-400">{desc}</span>
              </div>
            ))}
          </div>
          <Warn>
            I numeri del portfolio sono tutti simulati. Non viene investito denaro reale.
            I risultati passati non garantiscono risultati futuri.
          </Warn>
        </Section>

        <Section icon={<CalendarDays size={16} />} title="Calendario economico (/calendar)">
          <P>
            Mostra gli eventi macroeconomici della settimana: dati sull&apos;inflazione, decisioni sui tassi
            d&apos;interesse, dati sull&apos;occupazione, ecc. Questi eventi possono causare forti movimenti di prezzo.
          </P>
          <H>Livelli di impatto</H>
          <div className="space-y-2">
            {[
              { dot: "bg-red-500",    label: "Alto",  desc: "Può causare forti movimenti. Massima attenzione." },
              { dot: "bg-amber-500",  label: "Medio", desc: "Impatto moderato, da monitorare." },
              { dot: "bg-slate-500",  label: "Basso", desc: "Di solito poco rilevante per i mercati." },
            ].map(({ dot, label, desc }) => (
              <div key={label} className="flex items-center gap-3 p-3 bg-[#0a1628] rounded-lg border border-[#1a2e48]">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
                <span className="text-sm font-semibold text-slate-200 w-12 shrink-0">{label}</span>
                <span className="text-sm text-slate-400">{desc}</span>
              </div>
            ))}
          </div>
          <H>I dati mostrati</H>
          <P>
            Per ogni evento vedi: <strong className="text-white">Precedente</strong> (valore dell&apos;ultima
            pubblicazione), <strong className="text-white">Previsto</strong> (stima degli analisti),
            <strong className="text-white"> Attuale</strong> (dato appena pubblicato, se disponibile).
            Se l&apos;attuale supera il previsto è generalmente positivo per quella valuta.
          </P>
          <Tip>
            Evita di aprire trade pochi minuti prima di un evento ad alto impatto sulla valuta che stai analizzando.
          </Tip>
        </Section>

        {/* ── AGENTI ── */}
        <SectionLabel>Gli agenti di analisi</SectionLabel>

        <Section icon={<Brain size={16} />} title="Cosa sono gli agenti?" defaultOpen>
          <P>
            Gli <strong className="text-white">agenti</strong> sono moduli software specializzati che analizzano
            un aspetto specifico di un asset. Ognuno produce un <strong className="text-white">voto</strong> da
            −1 (molto negativo) a +1 (molto positivo). I voti vengono poi pesati e combinati per produrre
            il segnale finale.
          </P>
          <H>I 6 agenti del sistema</H>
          <div className="divide-y divide-[#1a2e48]">
            <AgentRow
              icon={<TrendingUp size={14} />}
              name="Agente Tecnico"
              desc="Analizza i grafici dei prezzi usando indicatori matematici (RSI, MACD, Medie Mobili, Bande di Bollinger, ADX). Cerca segnali di forza o debolezza nel movimento dei prezzi."
            />
            <AgentRow
              icon={<BarChart2 size={14} />}
              name="Agente Fondamentale"
              desc="Valuta la &quot;salute&quot; dell'asset: per le crypto guarda capitalizzazione, volume, dominanza BTC; per il forex guarda tassi d'interesse, inflazione, crescita economica del paese."
            />
            <AgentRow
              icon={<Newspaper size={14} />}
              name="Agente Notizie"
              desc="Scansiona le ultime notizie online e misura il sentiment (positivo/negativo). Notizie molto positive su un asset tendono a sostenere il prezzo."
            />
            <AgentRow
              icon={<Shield size={14} />}
              name="Agente Rischio"
              desc="Calcola quanto è rischioso entrare in quel momento: misura la volatilità recente, il drawdown, i livelli di supporto/resistenza e suggerisce Stop Loss e Take Profit."
            />
            <AgentRow
              icon={<Activity size={14} />}
              name="Agente COT (solo Forex)"
              desc="Legge il report settimanale della CFTC: mostra come sono posizionati i grandi operatori istituzionali. Se tutti i &quot;grandi&quot; comprano una valuta, è spesso un segnale rialzista."
            />
            <AgentRow
              icon={<Brain size={14} />}
              name="Agente di Sintesi"
              desc="Aggrega i voti di tutti gli altri agenti con pesi diversi a seconda del regime di mercato. Produce il segnale finale e il livello di confidenza."
            />
          </div>
        </Section>

        <Section icon={<RefreshCw size={16} />} title="Come imparano gli agenti nel tempo" badge="Adattivo">
          <P>
            Il sistema usa un meccanismo di <strong className="text-white">apprendimento adattivo</strong>:
            ogni segnale viene &quot;ricordato&quot;, e dopo alcune ore il sistema controlla se il prezzo
            si è mosso nella direzione prevista.
          </P>
          <H>Come funziona il ciclo</H>
          <div className="space-y-2">
            {[
              ["1", "Emissione", "Il sistema emette un BUY su BTC a $65.000. Viene salvato con data e prezzo."],
              ["2", "Verifica",  "Dopo 4–24 ore controlla il prezzo. Se BTC è a $67.000, l'esito è CORRETTO."],
              ["3", "Aggiornamento", "Se l'Agente Tecnico aveva voto alto sul segnale corretto, la sua 'reputazione' migliora e il suo peso nella Sintesi aumenta."],
            ].map(([num, title, desc]) => (
              <div key={num} className="flex gap-3 p-3 bg-[#0a1628] rounded-lg border border-[#1a2e48]">
                <span className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 text-xs font-bold text-blue-400 flex items-center justify-center shrink-0">{num}</span>
                <div>
                  <p className="text-sm font-semibold text-slate-200">{title}</p>
                  <p className="text-sm text-slate-400 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <Tip>
            Più segnali passano, più il sistema diventa preciso. Nelle prime settimane i pesi sono
            di default; dopo mesi di dati il sistema si è già ottimizzato sulla realtà osservata.
          </Tip>
        </Section>

        {/* ── INDICATORI ── */}
        <SectionLabel>Gli indicatori tecnici</SectionLabel>

        <Section icon={<TrendingUp size={16} />} title="Indicatori usati dall'agente tecnico">
          <P>
            Gli indicatori tecnici sono calcoli matematici applicati ai dati storici di prezzo e volume.
            Non predicono il futuro, ma descrivono lo stato attuale del mercato.
          </P>
          <div className="mt-2 divide-y divide-[#1a2e48]">
            <IndicatorRow
              name="RSI — Indice di Forza Relativa"
              short="Relative Strength Index"
              desc="Va da 0 a 100. Sopra 70 = asset 'ipercomprato' (salito troppo, potrebbe correggere). Sotto 30 = 'ipervenduto' (sceso troppo, potrebbe rimbalzare). Intorno a 50 è neutro."
            />
            <IndicatorRow
              name="MACD"
              short="Moving Average Convergence Divergence"
              desc="Confronta due medie mobili dei prezzi. Quando la linea MACD supera verso l'alto la linea del segnale è un indizio rialzista; quando scende sotto è ribassista."
            />
            <IndicatorRow
              name="Bande di Bollinger"
              short="Bollinger Bands"
              desc="Due fasce attorno al prezzo. Tocca la banda superiore = asset costoso rispetto alla media; tocca quella inferiore = a sconto. Bande strette = movimento forte in arrivo."
            />
            <IndicatorRow
              name="EMA — Media Mobile Esponenziale"
              short="Exponential Moving Average"
              desc="Media del prezzo degli ultimi N periodi con più peso sui dati recenti. Prezzo sopra EMA 200 = trend rialzista di lungo periodo."
            />
            <IndicatorRow
              name="ADX"
              short="Average Directional Index"
              desc="Misura la forza di un trend (non la direzione). Sopra 25 = trend forte; sotto 20 = mercato laterale senza direzione chiara."
            />
            <IndicatorRow
              name="Stocastico"
              short="Stochastic Oscillator"
              desc="Confronta il prezzo attuale con il range degli ultimi N periodi. Sopra 80 = ipercomprato; sotto 20 = ipervenduto. Usato per confermare i segnali dell'RSI."
            />
            <IndicatorRow
              name="Supporti e Resistenze"
              short="Support & Resistance"
              desc="Livelli di prezzo dove il mercato si è fermato o invertito storicamente. Un 'supporto' è un pavimento (il prezzo tende a rimbalzare). Una 'resistenza' è un soffitto (il prezzo tende a frenare)."
            />
            <IndicatorRow
              name="Analisi Multi-Timeframe"
              short="MTF"
              desc="L'agente analizza sia i grafici orari che quelli giornalieri. Un segnale che appare su entrambi i timeframe è più affidabile di uno che appare solo su uno."
            />
          </div>
        </Section>

        <Section icon={<Activity size={16} />} title="Cos'è il COT Report (solo Forex)">
          <P>
            Il <strong className="text-white">Commitment of Traders</strong> è un report settimanale
            pubblicato dalla CFTC americana. Mostra come sono posizionati i grandi operatori istituzionali
            (fondi hedge, banche) sui mercati futures delle valute.
          </P>
          <H>Le tre categorie di operatori</H>
          <div className="space-y-2">
            {[
              ["Commerciali",     "Aziende che si coprono dal rischio valutario. Non speculano."],
              ["Non-Commerciali", "Speculatori istituzionali (fondi hedge). Questi sono i più seguiti: le loro posizioni riflettono aspettative di lungo periodo."],
              ["Retail",          "Piccoli investitori. Spesso usati come contrarian indicator."],
            ].map(([label, desc]) => (
              <div key={label} className="flex gap-3 p-3 bg-[#0a1628] rounded-lg border border-[#1a2e48]">
                <span className="text-sm font-bold text-blue-400 w-28 shrink-0">{label}</span>
                <span className="text-sm text-slate-400 leading-relaxed">{desc}</span>
              </div>
            ))}
          </div>
          <Tip>
            Il COT è un indicatore di lungo periodo: cambia poco settimana per settimana. Ottimo per
            confermare la direzione macro, non per il trading di breve.
          </Tip>
        </Section>

        {/* ── SEGNALI ── */}
        <SectionLabel>I segnali spiegati</SectionLabel>

        <Section icon={<Zap size={16} />} title="Cosa significa ogni segnale" defaultOpen>
          <div className="space-y-3 mt-1">
            {[
              {
                rec: "STRONG_BUY",
                title: "Forte segnale d'acquisto",
                titleClass: "text-emerald-300",
                bg: "bg-emerald-500/8 border-emerald-500/20",
                desc: "Tutti (o quasi) gli agenti concordano su condizioni favorevoli. Alta confidenza. Il momento sembra favorevole per entrare in una posizione lunga (scommettere sul rialzo).",
              },
              {
                rec: "BUY",
                title: "Segnale d'acquisto",
                titleClass: "text-emerald-400",
                bg: "bg-emerald-500/5 border-emerald-500/15",
                desc: "La maggioranza degli agenti vede condizioni positive. Buona opportunità ma con qualche incertezza.",
              },
              {
                rec: "HOLD",
                title: "Attendi",
                titleClass: "text-amber-400",
                bg: "bg-amber-500/5 border-amber-500/15",
                desc: "Il mercato è indeciso o laterale. Non ci sono segnali chiari né in un senso né nell'altro. Meglio restare a guardare.",
              },
              {
                rec: "AVOID",
                title: "Evita",
                titleClass: "text-red-500",
                bg: "bg-red-900/10 border-red-900/20",
                desc: "Situazione ad alto rischio: volatilità elevata, fondamentali negativi o segnali tecnici pericolosi. Non è il momento di entrare.",
              },
              {
                rec: "SELL",
                title: "Segnale di vendita",
                titleClass: "text-red-400",
                bg: "bg-red-500/5 border-red-500/15",
                desc: "La maggioranza degli agenti vede condizioni negative. Per chi è già in posizione, potrebbe essere il momento di uscire.",
              },
              {
                rec: "STRONG_SELL",
                title: "Forte segnale di vendita",
                titleClass: "text-red-300",
                bg: "bg-red-500/8 border-red-500/20",
                desc: "Consensus negativo tra tutti gli agenti. Alta probabilità di continuo ribasso secondo il sistema.",
              },
            ].map(({ rec, title, titleClass, bg, desc }) => (
              <div key={rec} className={`flex items-start gap-3 p-4 border rounded-xl ${bg}`}>
                <div className="shrink-0 pt-0.5">
                  <SignalBadge rec={rec} />
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  <strong className={titleClass}>{title}.</strong>{" "}{desc}
                </p>
              </div>
            ))}
          </div>
          <Warn>
            I segnali si aggiornano ogni minuto. Un BUY ora potrebbe diventare HOLD tra 5 minuti
            se le condizioni cambiano. Controlla sempre il timestamp dell&apos;ultimo aggiornamento.
          </Warn>
        </Section>

        <Section icon={<TrendingDown size={16} />} title="Stop Loss e Take Profit">
          <P>
            Sono due livelli di prezzo suggeriti dall&apos;agente di Rischio per gestire ogni trade.
          </P>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <div className="p-4 bg-red-500/5 border border-red-500/15 rounded-xl">
              <p className="text-sm font-bold text-red-400 mb-1">Stop Loss (SL)</p>
              <p className="text-sm text-slate-400 leading-relaxed">
                Il prezzo a cui &quot;tagliare le perdite&quot;. Se BTC è a $65.000 e lo SL è $63.000,
                si esce se scende a $63.000, limitando la perdita al 3%.
              </p>
            </div>
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-xl">
              <p className="text-sm font-bold text-emerald-400 mb-1">Take Profit (TP)</p>
              <p className="text-sm text-slate-400 leading-relaxed">
                L&apos;obiettivo di guadagno. Se il TP è $69.000, si chiude il trade e si incassa il
                profitto quando BTC arriva lì.
              </p>
            </div>
          </div>
          <H>Risk/Reward Ratio</H>
          <P>
            Il rapporto rischio/rendimento. &quot;R/R 1:2&quot; significa che per ogni $1 rischiato,
            si punta a guadagnare $2. Sopra 1:1.5 è accettabile, sopra 1:2 è buono.
          </P>
        </Section>

        <Section icon={<Minus size={16} />} title="Regime di mercato: Trend vs Laterale">
          <P>
            Il <strong className="text-white">regime di mercato</strong> descrive il comportamento generale
            dei prezzi in un dato momento e determina quali agenti pesano di più nella Sintesi.
          </P>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <div className="p-4 bg-blue-500/5 border border-blue-500/15 rounded-xl">
              <p className="text-sm font-bold text-blue-400 mb-1">Mercato in Trend</p>
              <p className="text-sm text-slate-400 leading-relaxed">
                I prezzi si muovono chiaramente in una direzione. ADX sopra 25.
                L&apos;Agente Tecnico riceve più peso nella Sintesi.
              </p>
            </div>
            <div className="p-4 bg-purple-500/5 border border-purple-500/15 rounded-xl">
              <p className="text-sm font-bold text-purple-400 mb-1">Mercato Laterale</p>
              <p className="text-sm text-slate-400 leading-relaxed">
                I prezzi oscillano senza una direzione chiara. ADX sotto 20.
                Agente Fondamentale e COT ricevono più peso.
              </p>
            </div>
          </div>
          <Tip>
            Il regime viene rilevato automaticamente e cambia i pesi della Sintesi in tempo reale.
            Non devi fare nulla: è il sistema che si adatta.
          </Tip>
        </Section>

        {/* Footer */}
        <div className="text-center py-8">
          <p className="text-xs text-slate-600">
            Hai domande? Esplora le pagine e i dati — tutto è simulato, nessun rischio reale.
          </p>
          <Link href="/" className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold border border-[#1a2e48] text-slate-300 hover:text-white hover:border-blue-500/30 transition-all">
            <ArrowLeft size={13} /> Torna alla Dashboard
          </Link>
        </div>

      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-1 mt-2">
      <span className="h-px flex-1 bg-[#1a2e48]" />
      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">{children}</span>
      <span className="h-px flex-1 bg-[#1a2e48]" />
    </div>
  );
}
