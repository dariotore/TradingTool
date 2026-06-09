"use client";

import { useState, useEffect } from "react";
import { Newspaper, X, ChevronRight, ExternalLink, Loader2, AlertCircle } from "lucide-react";

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
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
    fetch(`${backend}/api/article?url=${encodeURIComponent(article.url)}`)
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
        className="bg-[#0f172a] border-t sm:border border-[#1e293b] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl h-[90vh] sm:h-auto sm:max-h-[85vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-[#1e293b] shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-white leading-snug">{displayTitle}</h2>
            {content?.published && (
              <p className="text-xs text-gray-500 mt-1">{content.published}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1 rounded-lg text-gray-500 hover:text-white hover:bg-[#1e293b] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
              <Loader2 size={22} className="animate-spin text-blue-400" />
              <span className="text-xs">Caricamento articolo...</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs text-orange-400">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
              {article.summary && (
                <p className="text-sm text-gray-400 leading-relaxed border-l-2 border-[#1e293b] pl-4">
                  {article.summary}
                </p>
              )}
            </div>
          )}

          {!loading && content && content.paragraphs.length > 0 && (
            <div className="flex flex-col gap-4">
              {content.paragraphs.map((p, i) => (
                <p key={i} className="text-sm text-gray-300 leading-relaxed">
                  {p}
                </p>
              ))}
            </div>
          )}

          {!loading && content && content.paragraphs.length === 0 && !error && (
            <div className="text-xs text-gray-500 text-center py-8">
              Contenuto non disponibile. Prova ad aprire l&apos;articolo originale.
            </div>
          )}
        </div>

        {/* Footer */}
        {article.url && (
          <div className="shrink-0 px-5 py-3 border-t border-[#1e293b] flex items-center justify-between">
            <span className="text-xs text-gray-600 truncate">
              {new URL(article.url).hostname.replace("www.", "")}
            </span>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-400 transition-colors"
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
      <div className="bg-[#111827] border border-[#1f2937] rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-gray-300 font-semibold text-sm">
          <Newspaper size={14} />
          Ultime Notizie
          {data?.details?.articles_found != null && (
            <span className="ml-auto text-xs text-gray-500">{data.details.articles_found} articoli</span>
          )}
        </div>

        {bd && (
          <div className="flex gap-3 text-xs">
            <span className="text-green-400">▲ {bd.positive} pos</span>
            <span className="text-red-400">▼ {bd.negative} neg</span>
            <span className="text-gray-500">— {bd.neutral} neu</span>
          </div>
        )}

        {articles.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {articles.map((a, i) => (
              <li key={i}>
                <button
                  onClick={() => setSelected(a)}
                  className="w-full text-left flex items-start gap-2 group px-2 py-1.5 rounded-lg hover:bg-[#1f2937] transition-colors"
                >
                  <span className="text-xs text-gray-400 leading-snug flex-1 group-hover:text-gray-200 transition-colors">
                    {a.title}
                  </span>
                  <ChevronRight size={11} className="shrink-0 mt-0.5 text-gray-600 group-hover:text-gray-400 transition-colors" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-gray-500 animate-pulse">Caricamento notizie...</div>
        )}
      </div>

      {selected && <ArticleModal article={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
