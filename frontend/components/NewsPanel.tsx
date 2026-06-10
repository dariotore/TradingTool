"use client";

import { useState, useEffect } from "react";
import { Newspaper, X, ChevronRight, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { getBackend } from "@/lib/backend";

interface Article {
  title: string;
  url?: string;
  summary?: string;
}

interface ArticleContent {
  title: string;
  paragraphs: string[];
  published: string;
  source_url: string;
}

interface NewsData {
  details?: {
    articles?: Article[];
    articles_found?: number;
    sentiment_breakdown?: { positive: number; negative: number; neutral: number };
  };
  signal?: string;
  score?: number;
}

function ArticleModal({ article, onClose }: { article: Article; onClose: () => void }) {
  const [content, setContent] = useState<ArticleContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!article.url) {
      setLoading(false);
      setError("URL non disponibile per questo articolo.");
      return;
    }
    fetch(`${getBackend()}/api/article?url=${encodeURIComponent(article.url)}`)
      .then(async r => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.detail ?? `Errore ${r.status}`);
        }
        return r.json() as Promise<ArticleContent>;
      })
      .then(data => {
        setContent(data);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message ?? "Impossibile caricare l'articolo.");
        setLoading(false);
      });
  }, [article.url]);

  const displayTitle = content?.title || article.title;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#070c18] border-t sm:border border-[#1a2e48] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl h-[90vh] sm:h-auto sm:max-h-[85vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-[#1a2e48] shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-white leading-snug">{displayTitle}</h2>
            {content?.published && (
              <p className="text-[10px] text-[var(--text-3)] mt-1">{content.published}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-[var(--text-3)] hover:text-white hover:bg-[#111d30] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Loader2 size={20} className="animate-spin text-blue-400" />
              <span className="text-xs text-[var(--text-3)]">Caricamento articolo...</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <AlertCircle size={13} />
                <span>{error}</span>
              </div>
              {article.summary && (
                <p className="text-sm text-[var(--text-2)] leading-relaxed border-l-2 border-[#1a2e48] pl-4">
                  {article.summary}
                </p>
              )}
            </div>
          )}

          {!loading && content && content.paragraphs.length > 0 && (
            <div className="flex flex-col gap-4">
              {content.paragraphs.map((p, i) => (
                <p key={i} className="text-sm text-[var(--text-2)] leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          )}

          {!loading && content && content.paragraphs.length === 0 && !error && (
            <div className="text-xs text-[var(--text-3)] text-center py-8">
              Contenuto non disponibile. Prova ad aprire l&apos;articolo originale.
            </div>
          )}
        </div>

        {/* Footer */}
        {article.url && (
          <div className="shrink-0 px-5 py-3 border-t border-[#1a2e48] flex items-center justify-between">
            <span className="text-xs text-[var(--text-3)] truncate">
              {new URL(article.url).hostname.replace("www.", "")}
            </span>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-[var(--text-3)] hover:text-blue-400 transition-colors"
            >
              <ExternalLink size={11} />
              Apri originale
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewsPanel({ data }: { data: NewsData | null }) {
  const [selected, setSelected] = useState<Article | null>(null);

  const articles = data?.details?.articles ?? [];
  const bd = data?.details?.sentiment_breakdown;

  return (
    <>
      <div className="card-accent-blue border border-[#1a2e48] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <Newspaper size={13} className="text-blue-400 shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)]">
            Ultime Notizie
          </span>
          {data?.details?.articles_found != null && (
            <span className="ml-auto text-[10px] text-[var(--text-3)]">{data.details.articles_found} articoli</span>
          )}
        </div>

        <div className="px-4 pb-4 flex flex-col gap-2.5">
          {bd && (
            <div className="flex gap-3 text-[10px] pb-1 border-b border-[#1a2e48]">
              <span className="text-emerald-400 font-semibold">▲ {bd.positive} pos</span>
              <span className="text-red-400 font-semibold">▼ {bd.negative} neg</span>
              <span className="text-[var(--text-3)]">— {bd.neutral} neu</span>
            </div>
          )}

          {articles.length > 0 ? (
            <ul className="flex flex-col gap-0.5">
              {articles.map((a, i) => (
                <li key={i}>
                  <button
                    onClick={() => setSelected(a)}
                    className="w-full text-left flex items-start gap-2 group px-2 py-1.5 rounded-lg hover:bg-[#111d30] transition-colors"
                  >
                    <span className="text-[11px] text-[var(--text-2)] leading-snug flex-1 group-hover:text-white transition-colors">
                      {a.title}
                    </span>
                    <ChevronRight size={10} className="shrink-0 mt-0.5 text-[var(--text-3)] group-hover:text-[var(--text-2)] transition-colors" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="shimmer h-3 rounded" style={{ width: `${[90, 75, 85, 60][i]}%` }} />
              ))}
            </div>
          )}
        </div>
      </div>

      {selected && <ArticleModal article={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
