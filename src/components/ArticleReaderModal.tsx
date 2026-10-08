/**
 * ArticleReaderModal - Distraction-free reading stage for articles, novel chapters,
 * and stories, featuring live sync with Sameera's voice reading aloud.
 */

import React, { useState } from 'react';
import { X, BookOpen, ExternalLink, Volume2, Copy, Check, Type, Minus, Plus } from 'lucide-react';
import { ArticleReaderState } from '../types/assistant';

interface ArticleReaderModalProps {
  reader: ArticleReaderState | null;
  onClose: () => void;
  onFocusParagraph: (paragraph: number, selectedText?: string) => void;
}

export const ArticleReaderModal: React.FC<ArticleReaderModalProps> = ({ reader, onClose, onFocusParagraph }) => {
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base');
  const [useSerif, setUseSerif] = useState(true);
  const [copied, setCopied] = useState(false);

  if (!reader || !reader.isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(`${reader.title}\n\n${reader.content}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenSource = () => {
    window.open(reader.url, '_blank', 'noopener,noreferrer');
  };

  const readingTimeMin = Math.max(1, Math.ceil(reader.wordCount / 200));

  const fontSizeClasses = {
    sm: 'text-sm leading-relaxed',
    base: 'text-base sm:text-lg leading-relaxed sm:leading-loose',
    lg: 'text-lg sm:text-xl leading-relaxed sm:leading-loose',
  }[fontSize];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Reader Container */}
      <div className="relative w-full max-w-3xl h-[86vh] sm:h-[88vh] bg-slate-950/95 backdrop-blur-2xl border border-violet-500/30 rounded-3xl shadow-2xl flex flex-col z-10 overflow-hidden text-white">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-3 overflow-hidden mr-2">
            <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/25 text-violet-400 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="overflow-hidden">
              <h3 className="text-sm sm:text-base font-semibold text-white truncate font-['Space_Grotesk']">
                {reader.title}
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-white/50">
                <span>{reader.wordCount} words</span>
                <span>•</span>
                <span>~{readingTimeMin} min read</span>
              </div>
            </div>
          </div>

          {/* Reader Preferences & Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Font Style Toggle */}
            <button
              onClick={() => setUseSerif(!useSerif)}
              className={`p-2 rounded-xl border text-xs font-semibold transition-colors ${
                useSerif
                  ? 'bg-white/15 border-white/20 text-white font-serif'
                  : 'bg-white/5 border-white/10 text-white/60 font-sans'
              }`}
              title={useSerif ? 'Switch to Sans-Serif font' : 'Switch to Serif font'}
            >
              {useSerif ? 'Serif' : 'Sans'}
            </button>

            {/* Font Size Adjuster */}
            <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5">
              <button
                onClick={() => setFontSize(fontSize === 'lg' ? 'base' : 'sm')}
                className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white"
                title="Decrease font size"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setFontSize(fontSize === 'sm' ? 'base' : 'lg')}
                className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white"
                title="Increase font size"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-colors"
              title="Copy text"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            {/* Source Link */}
            {reader.url && (
              <button
                onClick={handleOpenSource}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-colors"
                title="Open original website"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            )}

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Audio Narration Banner */}
        <div className="px-5 py-2.5 bg-gradient-to-r from-violet-600/20 via-cyan-500/10 to-transparent border-b border-violet-500/20 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-violet-300 font-medium">
            <Volume2 className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />
            <span>Ask Sameera about any paragraph. Select a passage to explain it.</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="w-1.5 h-3 rounded-full bg-cyan-400 animate-pulse" />
            <span className="w-1.5 h-4 rounded-full bg-violet-400 animate-pulse [animation-delay:150ms]" />
            <span className="w-1.5 h-2.5 rounded-full bg-cyan-300 animate-pulse [animation-delay:300ms]" />
          </div>
        </div>

        {/* Reader Document Body */}
        <div
          onScroll={(event) => {
            const container = event.currentTarget;
            const top = container.getBoundingClientRect().top;
            const visible = [...container.querySelectorAll<HTMLElement>('[data-paragraph]')].find((element) => element.getBoundingClientRect().bottom > top + 20);
            if (visible) onFocusParagraph(Number(visible.dataset.paragraph));
          }}
          className={`flex-1 overflow-y-auto px-6 sm:px-12 py-8 space-y-6 ${
            useSerif ? 'font-serif' : 'font-sans'
          } text-slate-100 ${fontSizeClasses} selection:bg-violet-500/40`}
        >
          {/* Article Title */}
          <div className="space-y-2 border-b border-white/10 pb-6 mb-8 font-sans">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
              {reader.title}
            </h1>
            {reader.url && (
              <p className="text-xs text-cyan-400/80 font-mono truncate">
                {reader.url}
              </p>
            )}
          </div>

          {/* Paragraphs and Headings */}
          {reader.paragraphs && reader.paragraphs.length > 0 ? (
            reader.paragraphs.map((para, idx) => {
              if (para.startsWith('## ')) {
                return (
                  <h2
                    key={idx}
                    data-paragraph={idx + 1}
                    className="text-xl sm:text-2xl font-bold font-sans text-cyan-200 pt-6 pb-2 border-b border-white/10 tracking-tight"
                  >
                    {para.replace('## ', '')}
                  </h2>
                );
              }
              return (
                <p key={idx} data-paragraph={idx + 1} onMouseUp={() => onFocusParagraph(idx + 1, window.getSelection()?.toString() || '')} onTouchEnd={() => onFocusParagraph(idx + 1, window.getSelection()?.toString() || '')} className="text-white/90 font-normal tracking-wide">
                  <span className="block text-[10px] text-cyan-300/60 font-sans mb-1">Paragraph {idx + 1}</span>
                  {para}
                </p>
              );
            })
          ) : (
            <p className="text-white/90 whitespace-pre-wrap">{reader.content}</p>
          )}
        </div>

        {/* Reader Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-xs text-white/50">
          <span>Say “explain paragraph 3” or select text and ask “explain this.”</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium transition-colors"
          >
            Done Reading
          </button>
        </div>
      </div>
    </div>
  );
};
