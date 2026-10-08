/**
 * InAppMediaModal - Floating on-screen media and website stage for YouTube videos,
 * music, articles, and interactive web portals requested during voice conversations.
 */

import React, { useState } from 'react';
import { X, ExternalLink, Maximize2, Minimize2, Copy, Check, Youtube, Globe, AlertCircle } from 'lucide-react';
import { MediaViewerState } from '../types/assistant';

interface InAppMediaModalProps {
  media: MediaViewerState | null;
  onClose: () => void;
}

export const InAppMediaModal: React.FC<InAppMediaModalProps> = ({ media, onClose }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  if (!media || !media.isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(media.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenExternal = () => {
    window.open(media.url, '_blank', 'noopener,noreferrer');
  };

  const isYouTube = media.type === 'youtube' || media.url.includes('youtube.com') || media.url.includes('youtu.be');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Main Modal Window */}
      <div
        className={`relative w-full ${
          isFullscreen ? 'max-w-[98vw] h-[96vh]' : 'max-w-4xl h-[78vh] sm:h-[82vh]'
        } bg-slate-950/95 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl flex flex-col z-10 overflow-hidden text-white transition-all duration-300`}
      >
        {/* Browser / Stage Top Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/10 bg-white/[0.04]">
          <div className="flex items-center gap-3 overflow-hidden mr-2">
            <div
              className={`p-2 rounded-xl border shrink-0 ${
                isYouTube
                  ? 'bg-rose-500/10 border-rose-500/25 text-rose-400'
                  : 'bg-cyan-500/10 border-cyan-500/25 text-cyan-400'
              }`}
            >
              {isYouTube ? <Youtube className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
            </div>

            <div className="overflow-hidden">
              <h3 className="text-sm sm:text-base font-semibold text-white truncate font-['Space_Grotesk']">
                {media.title || (isYouTube ? 'YouTube Player' : 'Web View')}
              </h3>
              <p className="text-[11px] text-white/40 truncate font-mono">
                {media.url}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={handleCopy}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-colors"
              title="Copy URL"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              onClick={handleOpenExternal}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/90 hover:text-white border border-white/15 text-xs font-medium transition-colors"
              title="Open in new browser tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Tab</span>
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-colors hidden sm:block"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-white/70 hover:text-rose-300 border border-white/10 transition-colors"
              title="Close viewer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Media Frame Viewport */}
        <div className="relative flex-1 w-full bg-black overflow-hidden flex flex-col">
          {iframeError ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="max-w-md">
                <h4 className="text-base font-semibold text-white">Direct preview restricted by website</h4>
                <p className="text-xs text-white/60 mt-1">
                  This website restricts being embedded in frames for security. Click below to open it immediately in a new tab!
                </p>
              </div>
              <button
                onClick={handleOpenExternal}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-semibold shadow-lg transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open in Full Browser Tab</span>
              </button>
            </div>
          ) : (
            <iframe
              src={media.embedUrl || media.url}
              title={media.title}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              onError={() => setIframeError(true)}
            />
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-2 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-[11px] text-white/40">
          <span>{isYouTube ? 'YouTube In-App Stage' : 'Live Web Preview Portal'}</span>
          <span className="flex items-center gap-1">
            <span>Powered by Sameera</span>
          </span>
        </div>
      </div>
    </div>
  );
};
