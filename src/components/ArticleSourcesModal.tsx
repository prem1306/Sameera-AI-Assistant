import React, { useState } from 'react';
import { BookOpen, X } from 'lucide-react';
import type { ArticleSearchState } from '../types/assistant';

export function ArticleSourcesModal({ search, onChoose, onClose }: {
  search: ArticleSearchState | null;
  onChoose: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  if (!search) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => { if (!loading) onClose(); }} />
      <section role="dialog" aria-modal="true" aria-labelledby="article-sources-title" className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl border border-white/20 bg-slate-950 p-6 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-cyan-300 mb-2">Article sources</p>
            <h2 id="article-sources-title" className="text-xl font-semibold">{search.topic}</h2>
            <p className="text-sm text-white/60 mt-2">Which website would you like? Choose below or tell Sameera. You can also ask her to choose for you.</p>
          </div>
          <button aria-label="Close article choices" disabled={!!loading} onClick={onClose} className="p-2 rounded-xl hover:bg-white/10"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3 mt-5">
          {search.articles.map((article, index) => (
            <button key={article.id} disabled={!!loading} onClick={async () => {
              setLoading(article.id); setError('');
              try { await onChoose(article.id); }
              catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not open this article'); }
              finally { setLoading(null); }
            }} className="w-full text-left flex gap-3 p-4 rounded-2xl border border-white/15 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cyan-400 disabled:opacity-60">
              <BookOpen className="w-5 h-5 shrink-0 text-cyan-300 mt-1" />
              <div>
                <span className="text-xs text-cyan-300">{index + 1}. {article.website}</span>
                <p className="text-sm font-medium mt-1">{article.title}</p>
                <span className="text-xs text-white/50">{loading === article.id ? 'Opening article…' : 'Open in reader'}</span>
              </div>
            </button>
          ))}
        </div>
        {error && <p role="alert" className="text-sm text-rose-300 mt-4">{error}</p>}
        {search.provider && <p className="text-xs text-white/40 mt-4">Sources found through {search.provider}. Availability and full-text access vary by publisher.</p>}
        {search.searchSuggestionsHtml && <iframe title="Google Search suggestions" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={search.searchSuggestionsHtml} className="w-full h-28 mt-4 border-0" />}
      </section>
    </div>
  );
}
