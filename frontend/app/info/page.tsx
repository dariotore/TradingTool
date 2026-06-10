"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ChevronDown, ChevronUp, RefreshCw,
  LayoutGrid, History, BarChart2, Briefcase, CalendarDays,
  TrendingUp, Shield, Activity, Newspaper, Brain,
  Star, EyeOff, Zap, BookOpen,
  TrendingDown, Minus, AlertTriangle, Info,
} from "lucide-react";

// ── Accordion ─────────────────────────────────────────────────────────────────

function Section({
  icon, title, badge, children, defaultOpen = false,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-[#0e1b2e] border border-[#1a2e48] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#111d30] transition-colors"
      >
        <span className="text-blue-400">{icon}</span>
        <span className="flex-1 text-sm font-bold text-white">{title}</span>
        {badge && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
            {badge}
          </span>
        )}
        {open ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
      </button>
      {open && (
        <div className="px-4 pb-5 pt-1 border-t border-[#1a2e48] space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] text-slate-300 leading-relaxed">{children}</p>;
}

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-bold text-slate-200 uppercase tracking-wider mt-4 mb-1">{children}</h3>;
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 bg-blue-500/8 border border-blue-500/20 rounded-lg p-3 mt-2">
      <Info size={12} className="text-blue-400 shrink-0 mt-0.5" />
      <p className="text-[11px] text-blue-200 leading-relaxed">{children}</p>
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 bg-amber-500/8 border border-amber-500/20 rounded-lg p-3 mt-2">
      <AlertTriangle size={12} className="text-amber-400 shrink-0 mt-0.5" />
      <p className="text-[11px] text-amber-200 leading-relaxed">{children}</p>
    </div>
  );
}

function SignalBadge({ rec }: { rec: string }) {
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    STRONG_BUY:  { bg: "bg-emerald-500/15", text: "text-emerald-300", label: "STRONG BUY"  },
    BUY:         { bg: "bg-emerald-500/15", text: "text-emerald-400", label: "BUY"          },
    HOLD:        { bg: "bg-amber-500/15",   text: "text-amber-400",   label: "HOLD"         },
    AVOID:       { bg: "bg-red-900/20",     text: "text-red-600",     label: "AVOID"        },
    SELL:        { bg: "bg-red-500/15",     text: "text-red-400",     label: "SELL"         },
    STRONG_SELL: { bg: "bg-red-500/15",     text: "text-red-300",     label: "STRONG SELL"  },
  };
  const c = cfg[rec] ?? cfg.HOLD;
  return (
    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

function AgentRow({ icon, name, desc }: { icon: React.ReactNode; name: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[#1a2e48] last:border-0">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div>
        <p className="text-[11px] font-bold text-slate-200">{name}</p>
        <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function IndicatorRow({ name, short, desc }: { name: string; short: string; desc: string }) {
  return (
    <div className="py-2.5 border-b border-[#1a2e48] last:border-0">
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] font-bold text-white">{name}</span>
        <span className="text-[10px] text-slate-500">({short})</span>
      </div>
      <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">{desc}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InfoPage() {
  return (
    <div className="min-h-screen bg-[#070c18] text-white flex flex-col">

      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-[#1a2e48] bg-[#070c18]/80 backdrop-blur-sm sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-white hover:bg-[#111d30] border border-[#1a2e48] transition-all">
          <ArrowLeft size={12} /> Dashboard
        </Link>
        <div>
          <h1 className="text-sm font-bold text-white leading-none">Guida alla piattaforma</h1>
          <p className="text-[10px] text-slate-500 mt-0.5">Come funziona tutto — spiegato senza gergo tecnico</p>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-4 py-5 max-w-3xl mx-auto w-full flex flex-col gap-3">

        {/* Intro card */}
        <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={14} className="text-blue-400" />
            <span className="text-sm font-bold text-white">Benvenuto nella guida</span>
          </div>
          <p className="text-[12px] text-slate-300 leading-relaxed">
            Questa piattaforma analizza automaticamente criptovalute e valute forex usando degli
            <strong className="text-white"> agenti intelligenti</strong>. Non devi capire la finanza per usarla:
            ogni asset riceve un segnale semplice (COMPRA / VENDI / ATTENDI) basato su centinaia di dati analizzati in automatico.
          </p>
          <Tip>
            Nessun segnale è una certezza. Usa sempre la tua testa e non investire mai più di quanto puoi permetterti di perdere.
          </Tip>
        </div>

        {/* ── PAGINE ── */}
        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-1 mt-2">Le pagine</div>

        <Section icon={<LayoutGrid size={14} />} title="Dashboard (pagina principale)" defaultOpen>
          <P>
            È la schermata che vedi aprendo l&apos;app. A sinistra trovi la lista di tutti gli asset monitorati
            (crypto e forex). Cliccando su uno, a destra appaiono tutti i dettagli.
          </P>
          <H>Cosa vedi nella lista</H>
          <P>
            Ogni riga mostra il nome dell&apos;asset, il prezzo attuale, la variazione nelle ultime 24 ore
            e un pallino colorato con il segnale. Il sistema si aggiorna automaticamente ogni minuto.
          </P>
          <H>Segnali rapidi</H>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {["STRONG_BUY","BUY","HOLD","AVOID","SELL","STRONG_SELL"].map(r => <SignalBadge key={r} rec={r} />)}
          </div>
          <P>
            I segnali verdi (BUY / STRONG BUY) significano &quot;il sistema vede condizioni favorevoli all&apos;acquisto&quot;.
            I rossi (SELL / STRONG SELL) suggeriscono condizioni negative. Arancione (HOLD) = situazione incerta,
            meglio aspettare. Rosso scuro (AVOID) = rischio elevato, da evitare.
          </P>
          <H>Watchlist — stelle e occhio</H>
          <P>
            Passando il mouse su un asset appaiono due icone:
          </P>
          <div className="flex items-start gap-3 mt-1">
            <div className="flex items-center gap-2">
              <Star size={12} className="text-amber-400" />
              <span className="text-[11px] text-slate-300">Fissa in cima alla lista (preferiti)</span>
            </div>
          </div>
          <div className="flex items-start gap-3 mt-1">
            <div className="flex items-center gap-2">
              <EyeOff size={12} className="text-slate-500" />
              <span className="text-[11px] text-slate-300">Nascondi l&apos;asset (puoi ritrovarlo in fondo)</span>
            </div>
          </div>
          <Tip>Le preferenze della watchlist vengono salvate nel browser e rimangono anche dopo aver chiuso la pagina.</Tip>
        </Section>

        <Section icon={<BarChart2 size={14} />} title="Pannello dettaglio asset">
          <P>
            Cliccando su un asset nella dashboard si apre il pannello di dettaglio con quattro schede:
          </P>
          <H>Scheda Analisi</H>
          <P>
            Mostra le schede degli agenti (Tecnico, Fondamentale, Notizie, Rischio) con i loro voti
            e il pannello di sintesi finale con il segnale complessivo, il livello di confidenza
            e le motivazioni dell&apos;analisi.
          </P>
          <H>Scheda Grafico</H>
          <P>
            Mostra l&apos;andamento del prezzo con indicatori tecnici sovrapposti (EMA, Bande di Bollinger).
          </P>
          <H>Scheda Notizie</H>
          <P>
            Elenca le ultime notizie rilevanti trovate online per quell&apos;asset, con un punteggio di sentiment.
          </P>
          <H>Livello di confidenza</H>
          <P>
            Ogni segnale ha una percentuale di confidenza (0–100%). Più è alta, più gli agenti sono
            &quot;d&apos;accordo&quot; tra loro. Sotto il 55% la situazione è incerta.
          </P>
        </Section>

        <Section icon={<History size={14} />} title="Storico segnali (/history)">
          <P>
            Registra ogni segnale emesso nel tempo, con data, asset, segnale, prezzo al momento
            e — quando disponibile — il prezzo successivo per capire se il segnale era corretto.
          </P>
          <H>Esito</H>
          <P>
            Dopo alcune ore il sistema controlla automaticamente se il prezzo si è mosso nella direzione
            suggerita. Se un BUY è stato seguito da un rialzo di prezzo, l&apos;esito è &quot;✓ Corretto&quot;.
            Questi dati alimentano il sistema di apprendimento degli agenti.
          </P>
        </Section>

        <Section icon={<BarChart2 size={14} />} title="Statistiche (/stats)">
          <P>
            Mostra le performance storiche del sistema. Utile per capire quanto bene stanno
            funzionando gli agenti nel tempo.
          </P>
          <H>Win Rate</H>
          <P>Percentuale di segnali che si sono rivelati corretti. Es: 65% = 65 segnali su 100 erano giusti.</P>
          <H>Profit Factor</H>
          <P>
            Rapporto tra guadagni e perdite teorici. Un valore sopra 1.0 significa che i segnali giusti
            &quot;pesano&quot; di più di quelli sbagliati.
          </P>
          <H>Sharpe Ratio</H>
          <P>
            Misura quanto rendimento si ottiene rispetto al rischio preso. Sopra 1.0 è considerato buono,
            sopra 2.0 è ottimo.
          </P>
          <H>Max Drawdown</H>
          <P>
            La massima perdita consecutiva registrata nel periodo. Es: -12% significa che nel peggior
            momento il portafoglio simulato aveva perso il 12% dal suo massimo.
          </P>
          <H>Performance per agente</H>
          <P>
            La tabella mostra l&apos;accuratezza di ogni agente: qual è il più affidabile, quale tende
            a sbagliare di più. Il sistema usa questi dati per pesare automaticamente i voti.
          </P>
        </Section>

        <Section icon={<Briefcase size={14} />} title="Portfolio simulato (/portfolio)">
          <P>
            Il <strong className="text-white">paper trading</strong> è una simulazione: il sistema apre
            e chiude posizioni fittizie di $1.000 ogni volta che emette un segnale BUY o SELL, senza
            usare denaro reale. Serve a vedere come avrebbe performato la strategia.
          </P>
          <H>Apertura automatica</H>
          <P>
            Quando il segnale cambia in BUY o SELL, il sistema registra una &quot;posizione aperta&quot;
            con il prezzo corrente, uno Stop Loss (prezzo massimo di perdita accettabile) e un
            Take Profit (obiettivo di guadagno).
          </P>
          <H>Chiusura automatica</H>
          <P>Ogni ora il sistema controlla tutti i trade aperti. Una posizione si chiude quando:</P>
          <ul className="space-y-1 mt-1">
            {[
              ["SL",      "il prezzo scende sotto lo Stop Loss"],
              ["TP",      "il prezzo sale sopra il Take Profit"],
              ["REVERSE", "il segnale si inverte (da BUY a SELL o viceversa)"],
              ["SIGNAL",  "il segnale torna a HOLD o AVOID"],
              ["MANUAL",  "premi il pulsante Chiudi nella tabella"],
            ].map(([label, desc]) => (
              <li key={label} className="flex gap-2 text-[11px] text-slate-300">
                <span className="font-bold text-slate-200 w-14 shrink-0">{label}</span>
                <span className="text-slate-400">{desc}</span>
              </li>
            ))}
          </ul>
          <Warn>
            I numeri del portfolio sono tutti simulati. Non viene investito denaro reale.
            I risultati passati non garantiscono risultati futuri.
          </Warn>
        </Section>

        <Section icon={<CalendarDays size={14} />} title="Calendario economico (/calendar)">
          <P>
            Mostra gli eventi macroeconomici della settimana corrente: dati sull&apos;inflazione,
            decisioni sui tassi di interesse, dati sull&apos;occupazione, ecc.
            Questi eventi possono causare forti movimenti di prezzo.
          </P>
          <H>Impatto</H>
          <ul className="space-y-1 mt-1">
            {[
              ["🔴 Alto",  "Può causare forti movimenti. Massima attenzione."],
              ["🟡 Medio", "Impatto moderato, da monitorare."],
              ["⚪ Basso", "Di solito poco rilevante per i mercati."],
            ].map(([label, desc]) => (
              <li key={label} className="text-[11px] text-slate-300">
                <span className="font-semibold text-slate-200">{label}</span>
                <span className="text-slate-400"> — {desc}</span>
              </li>
            ))}
          </ul>
          <H>Dati mostrati</H>
          <P>
            Per ogni evento vedi: <strong className="text-white">Precedente</strong> (valore dell&apos;ultima volta),
            <strong className="text-white"> Previsto</strong> (stima degli analisti),
            <strong className="text-white"> Attuale</strong> (dato appena pubblicato, se disponibile).
            Se l&apos;attuale supera il previsto è generalmente positivo per quella valuta.
          </P>
          <Tip>
            Evita di aprire trade pochi minuti prima di un evento ad alto impatto sulla valuta che stai analizzando.
          </Tip>
        </Section>

        {/* ── AGENTI ── */}
        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-1 mt-3">Gli agenti di analisi</div>

        <Section icon={<Brain size={14} />} title="Cosa sono gli agenti?" defaultOpen>
          <P>
            Gli <strong className="text-white">agenti</strong> sono moduli software specializzati che analizzano
            un aspetto specifico di un asset. Ognuno produce un <strong className="text-white">voto</strong> da
            -1 (molto negativo) a +1 (molto positivo). I voti vengono poi pesati e combinati dall&apos;agente
            di Sintesi per produrre il segnale finale.
          </P>
          <P>
            Ogni tipo di mercato (crypto, forex, commodities) ha i propri agenti specializzati,
            ma tutti seguono la stessa logica di base.
          </P>
          <H>Agenti presenti nel sistema</H>
          <AgentRow
            icon={<TrendingUp size={12} />}
            name="Agente Tecnico"
            desc="Analizza i grafici dei prezzi usando indicatori matematici (RSI, MACD, Medie Mobili, Bande di Bollinger, ADX). Cerca segnali di forza o debolezza nel movimento dei prezzi."
          />
          <AgentRow
            icon={<BarChart2 size={12} />}
            name="Agente Fondamentale"
            desc="Valuta la &quot;salute&quot; dell'asset: per le crypto guarda capitalizzazione, volume, dominanza BTC; per il forex guarda tassi d'interesse, inflazione, crescita economica del paese."
          />
          <AgentRow
            icon={<Newspaper size={12} />}
            name="Agente Notizie"
            desc="Scansiona le ultime notizie online e misura il sentiment (positivo/negativo). Notizie molto positive su un asset tendono a sostenere il prezzo."
          />
          <AgentRow
            icon={<Shield size={12} />}
            name="Agente Rischio"
            desc="Calcola quanto è rischioso entrare in quel momento: misura la volatilità recente, il drawdown, i livelli di supporto/resistenza e suggerisce Stop Loss e Take Profit."
          />
          <AgentRow
            icon={<Activity size={12} />}
            name="Agente COT (solo Forex)"
            desc="Legge il report COT (Commitment of Traders) della CFTC: mostra come stanno posizionati i grandi operatori istituzionali. Se tutti i &quot;grandi&quot; comprano una valuta, spesso è un segnale rialzista."
          />
          <AgentRow
            icon={<Brain size={12} />}
            name="Agente di Sintesi"
            desc="Aggrega i voti di tutti gli altri agenti con pesi diversi a seconda del regime di mercato (trend forte vs laterale). Produce il segnale finale e il livello di confidenza."
          />
        </Section>

        <Section icon={<RefreshCw size={14} />} title="Come imparano gli agenti nel tempo" badge="Adattivo">
          <P>
            Il sistema usa un meccanismo di <strong className="text-white">apprendimento adattivo</strong>:
            ogni segnale emesso viene &quot;ricordato&quot;, e dopo alcune ore il sistema controlla se
            il prezzo si è mosso nella direzione prevista.
          </P>
          <H>Step 1 — Emissione del segnale</H>
          <P>Il sistema emette un BUY su BTC a $65.000. Viene salvato nel database con data e prezzo.</P>
          <H>Step 2 — Verifica dell&apos;esito</H>
          <P>Dopo 4–24 ore il sistema controlla il prezzo. Se BTC è salito a $67.000, l&apos;esito è CORRECT.</P>
          <H>Step 3 — Aggiornamento dei pesi</H>
          <P>
            Se un agente (es. Tecnico) aveva voto alto su quel segnale corretto, la sua &quot;reputazione&quot;
            migliora. Se invece aveva voto alto su un segnale sbagliato, la sua reputazione peggiora.
            I pesi nella Sintesi si aggiustano di conseguenza.
          </P>
          <Tip>
            Più segnali passano, più il sistema diventa preciso. Nelle prime settimane i pesi sono
            ancora &quot;di default&quot;; dopo mesi di dati il sistema si è già ottimizzato sulla base
            della realtà osservata.
          </Tip>
        </Section>

        {/* ── INDICATORI ── */}
        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-1 mt-3">Gli indicatori tecnici</div>

        <Section icon={<TrendingUp size={14} />} title="Indicatori usati dall'agente tecnico">
          <P>
            Gli indicatori tecnici sono calcoli matematici applicati ai dati storici di prezzo e volume.
            Non predicono il futuro, ma descrivono lo stato attuale del mercato.
          </P>
          <IndicatorRow
            name="RSI — Indice di Forza Relativa"
            short="Relative Strength Index"
            desc="Va da 0 a 100. Sopra 70 significa che l'asset è 'ipercomprato' (salito troppo velocemente, potrebbe correggere). Sotto 30 è 'ipervenduto' (sceso troppo, potrebbe rimbalzare). Attorno a 50 è neutro."
          />
          <IndicatorRow
            name="MACD"
            short="Moving Average Convergence Divergence"
            desc="Confronta due medie mobili dei prezzi. Quando la linea MACD supera verso l'alto la linea del segnale, è un indizio rialzista. Quando la scende sotto, è ribassista. Utile per identificare l'inizio di trend."
          />
          <IndicatorRow
            name="Bande di Bollinger"
            short="Bollinger Bands"
            desc="Due fasce intorno al prezzo. Quando il prezzo tocca la banda superiore l'asset è costoso rispetto alla media recente; quando tocca quella inferiore è a sconto. Quando le bande si stringono, si aspetta un movimento forte in arrivo."
          />
          <IndicatorRow
            name="EMA — Media Mobile Esponenziale"
            short="Exponential Moving Average"
            desc="Media del prezzo degli ultimi N giorni con più peso sui dati recenti. L'EMA 50 è la media degli ultimi 50 periodi; l'EMA 200 degli ultimi 200. Prezzo sopra EMA 200 = trend rialzista di lungo periodo."
          />
          <IndicatorRow
            name="ADX"
            short="Average Directional Index"
            desc="Misura la forza di un trend (non la direzione). Sopra 25 indica un trend forte; sotto 20 il mercato è laterale (senza direzione chiara). L'ADX influenza il peso degli agenti nella Sintesi."
          />
          <IndicatorRow
            name="Stocastico"
            short="Stochastic Oscillator"
            desc="Simile all'RSI, confronta il prezzo attuale con il range degli ultimi N periodi. Sopra 80 = zona di ipercomprato; sotto 20 = ipervenduto. Usato per confermare i segnali dell'RSI."
          />
          <IndicatorRow
            name="Supporti e Resistenze"
            short="Support & Resistance"
            desc="Livelli di prezzo dove storicamente il mercato si è fermato o invertito. Un 'supporto' è un pavimento (il prezzo tende a rimbalzare). Una 'resistenza' è un soffitto (il prezzo tende a frenare). L'agente usa questi livelli per il calcolo di Stop Loss e Take Profit."
          />
          <IndicatorRow
            name="Struttura di mercato"
            short="Market Structure (HH/HL/LH/LL)"
            desc="Analizza se il mercato sta creando massimi e minimi crescenti (trend rialzista: HH/HL) o decrescenti (trend ribassista: LH/LL). È una lettura 'visiva' della direzione complessiva."
          />
          <IndicatorRow
            name="Analisi Multi-Timeframe"
            short="MTF — Multi Timeframe"
            desc="L'agente analizza sia i grafici orari che quelli giornalieri. Un segnale che appare su entrambi i timeframe è più affidabile di uno che appare solo su uno."
          />
        </Section>

        <Section icon={<Activity size={14} />} title="Cos'è il COT Report (solo Forex)">
          <P>
            Il <strong className="text-white">Commitment of Traders</strong> è un report settimanale pubblicato
            dalla CFTC americana. Mostra come sono posizionati i grandi operatori istituzionali (fondi hedge,
            banche) sui mercati futures delle valute.
          </P>
          <H>Come si legge</H>
          <P>
            Ci sono tre categorie di operatori: <strong className="text-white">Commerciali</strong> (aziende che
            si coprono dal rischio valutario), <strong className="text-white">Non-Commerciali</strong> (speculatori
            istituzionali) e <strong className="text-white">Retail</strong>. Il sistema si concentra sui
            Non-Commerciali: se hanno una posizione netta lunga (comprata) su EUR, è un segnale rialzista per EUR/USD.
          </P>
          <Tip>
            Il COT è un indicatore di lungo periodo: cambia poco settimana per settimana. Ottimo per confermare
            la direzione macro, non per il trading di breve.
          </Tip>
        </Section>

        {/* ── SEGNALI ── */}
        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-1 mt-3">I segnali spiegati</div>

        <Section icon={<Zap size={14} />} title="Cosa significa ogni segnale" defaultOpen>
          <div className="space-y-3 mt-1">
            <div className="flex items-start gap-3 p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-lg">
              <SignalBadge rec="STRONG_BUY" />
              <p className="text-[11px] text-slate-300 leading-relaxed">
                <strong className="text-emerald-300">Forte segnale d&apos;acquisto.</strong> Tutti (o quasi) gli agenti
                concordano su condizioni favorevoli. Alta confidenza. Il momento sembra favorevole per entrare in una
                posizione lunga (scommettere sul rialzo).
              </p>
            </div>
            <div className="flex items-start gap-3 p-3 bg-emerald-500/5 border border-emerald-500/15 rounded-lg">
              <SignalBadge rec="BUY" />
              <p className="text-[11px] text-slate-300 leading-relaxed">
                <strong className="text-emerald-400">Segnale d&apos;acquisto.</strong> La maggioranza degli agenti
                vede condizioni positive. Buona opportunità ma con qualche incertezza.
              </p>
            </div>
            <div className="flex items-start gap-3 p-3 bg-amber-500/5 border border-amber-500/15 rounded-lg">
              <SignalBadge rec="HOLD" />
              <p className="text-[11px] text-slate-300 leading-relaxed">
                <strong className="text-amber-400">Attendi.</strong> Il mercato è indeciso o laterale. Non ci sono
                segnali chiari né in un senso né nell&apos;altro. Meglio restare a guardare.
              </p>
            </div>
            <div className="flex items-start gap-3 p-3 bg-red-900/10 border border-red-900/20 rounded-lg">
              <SignalBadge rec="AVOID" />
              <p className="text-[11px] text-slate-300 leading-relaxed">
                <strong className="text-red-600">Evita.</strong> La situazione è ad alto rischio: volatilità elevata,
                fondamentali negativi o segnali tecnici pericolosi. Non è il momento di entrare.
              </p>
            </div>
            <div className="flex items-start gap-3 p-3 bg-red-500/5 border border-red-500/15 rounded-lg">
              <SignalBadge rec="SELL" />
              <p className="text-[11px] text-slate-300 leading-relaxed">
                <strong className="text-red-400">Segnale di vendita.</strong> La maggioranza degli agenti vede
                condizioni negative. Per chi è già in posizione, potrebbe essere il momento di uscire.
              </p>
            </div>
            <div className="flex items-start gap-3 p-3 bg-red-500/8 border border-red-500/20 rounded-lg">
              <SignalBadge rec="STRONG_SELL" />
              <p className="text-[11px] text-slate-300 leading-relaxed">
                <strong className="text-red-300">Forte segnale di vendita.</strong> Consensus negativo tra tutti
                gli agenti. Alta probabilità di continuo ribasso secondo il sistema.
              </p>
            </div>
          </div>
          <Warn>
            I segnali si aggiornano ogni minuto. Un BUY ora potrebbe diventare HOLD tra 5 minuti
            se le condizioni cambiano. Controlla sempre il timestamp dell&apos;ultimo aggiornamento.
          </Warn>
        </Section>

        <Section icon={<TrendingDown size={14} />} title="Stop Loss e Take Profit">
          <P>
            Sono due livelli di prezzo suggeriti dall&apos;agente di Rischio per gestire ogni trade.
          </P>
          <H>Stop Loss (SL)</H>
          <P>
            È il prezzo a cui &quot;tagliare le perdite&quot;. Se compri BTC a $65.000 e lo SL è a $63.000,
            significa che si esce dal trade se BTC scende a $63.000, limitando la perdita al 3%.
            Nel portfolio simulato, il trade si chiude automaticamente quando il prezzo tocca lo SL.
          </P>
          <H>Take Profit (TP)</H>
          <P>
            È l&apos;obiettivo di guadagno. Se il TP è a $69.000, si porta a casa il profitto quando
            BTC arriva lì. Un buon rapporto rischio/rendimento ha il TP almeno 2 volte più lontano dello SL
            (es: SL -3%, TP +6%).
          </P>
          <H>Risk/Reward Ratio</H>
          <P>
            Nell&apos;analisi vedi spesso &quot;R/R 1:2&quot; — significa che per ogni $1 rischiato, si punta
            a guadagnare $2. Sopra 1:1.5 è considerato accettabile, sopra 1:2 è buono.
          </P>
        </Section>

        <Section icon={<Minus size={14} />} title="Regime di mercato: Trend vs Laterale">
          <P>
            Il <strong className="text-white">regime di mercato</strong> descrive il &quot;comportamento&quot;
            generale dei prezzi in un dato momento.
          </P>
          <H>Mercato in Trend</H>
          <P>
            I prezzi si muovono chiaramente in una direzione (su o giù). L&apos;ADX è sopra 25.
            In questo regime l&apos;agente Tecnico riceve più peso nella Sintesi, perché gli indicatori
            di trend funzionano meglio.
          </P>
          <H>Mercato Laterale (Ranging)</H>
          <P>
            I prezzi oscillano su e giù senza una direzione chiara. L&apos;ADX è sotto 20.
            In questo regime l&apos;agente Fondamentale e il COT (forex) ricevono più peso,
            mentre gli indicatori di trend diventano meno affidabili.
          </P>
          <Tip>
            Il regime viene rilevato automaticamente e cambia i pesi della Sintesi in tempo reale.
            Non devi fare nulla: è il sistema che si adatta.
          </Tip>
        </Section>

        {/* Footer */}
        <div className="text-center py-6">
          <p className="text-[10px] text-slate-600">
            Hai domande? Esplora le pagine e i dati — tutto è simulato, nessun rischio reale.
          </p>
          <Link href="/" className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-lg text-xs font-semibold border border-[#1a2e48] text-slate-300 hover:text-white hover:border-blue-500/30 transition-all">
            <ArrowLeft size={11} /> Torna alla Dashboard
          </Link>
        </div>

      </div>
    </div>
  );
}
