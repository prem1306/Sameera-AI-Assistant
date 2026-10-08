/**
 * ToolActionToast - Real-time floating glass card displaying actions executed
 * by Sameera (e.g. Opening YouTube, setting themes, recording notes, checking time).
 */

import React, { useEffect, useState } from 'react';
import { ExternalLink, CheckCircle2, Clock, Palette, StickyNote, Search, X } from 'lucide-react';
import { ToolExecutionEvent } from '../types/assistant';

interface ToolActionToastProps {
  event: ToolExecutionEvent | null;
  onDismiss: () => void;
}

export const ToolActionToast: React.FC<ToolActionToastProps> = ({ event, onDismiss }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (event) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300);
      }, 7000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [event, onDismiss]);

  if (!event || !visible) return null;

  const getIcon = () => {
    switch (event.name) {
      case 'openWebsite':
        return <ExternalLink className="w-5 h-5 text-cyan-400" />;
      case 'getDateTime':
        return <Clock className="w-5 h-5 text-amber-400" />;
      case 'controlVisualTheme':
        return <Palette className="w-5 h-5 text-violet-400" />;
      case 'takeQuickNote':
        return <StickyNote className="w-5 h-5 text-emerald-400" />;
      case 'searchWeb':
        return <Search className="w-5 h-5 text-sky-400" />;
      default:
        return <CheckCircle2 className="w-5 h-5 text-purple-400" />;
    }
  };

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[92%] transition-all duration-300 transform animate-in fade-in slide-in-from-top-4">
      <div className="relative overflow-hidden rounded-2xl bg-slate-900/85 backdrop-blur-2xl border border-white/15 p-4 shadow-[0_10px_35px_rgba(0,0,0,0.6)] flex items-start gap-3.5">
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 shrink-0">
          {getIcon()}
        </div>

        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Tool Action
            </span>
            <span className="text-[10px] text-white/30">• {event.timestamp}</span>
          </div>

          <h4 className="text-sm font-semibold text-white truncate mt-0.5">
            {event.title}
          </h4>

          <p className="text-xs text-white/70 mt-0.5 line-clamp-2 leading-relaxed">
            {event.description}
          </p>

          {event.url && (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
            >
              <span>Visit Link</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        <button
          onClick={() => {
            setVisible(false);
            setTimeout(onDismiss, 200);
          }}
          className="absolute top-3 right-3 p-1 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Shimmer accent line at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
      </div>
    </div>
  );
};
