"use client";

import { Brain } from "lucide-react";

export default function TextAnalysisPanel({
  text,
  isForex = false,
}: {
  text?: string | null;
  isForex?: boolean;
}) {
  return (
    <div className="bg-[#0e1b2e] border border-[#1a2e48] rounded-xl overflow-hidden card-accent-blue">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Brain size={14} className="text-blue-400 shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)]">
          Analisi {isForex ? "Forex" : "AI"} — Spiegazione del risultato
        </span>
      </div>

      {/* Body */}
      <div className="px-4 pb-4">
        {text ? (
          <div className="border-l-2 border-blue-500/40 pl-3">
            <p className="text-sm text-[var(--text-2)] leading-relaxed">{text}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 animate-pulse pl-3 border-l-2 border-[#1a2e48]">
            <div className="h-3 bg-[#1a2e48] rounded w-full" />
            <div className="h-3 bg-[#1a2e48] rounded w-11/12" />
            <div className="h-3 bg-[#1a2e48] rounded w-4/5" />
            <div className="h-3 bg-[#1a2e48] rounded w-3/4" />
          </div>
        )}
      </div>
    </div>
  );
}
