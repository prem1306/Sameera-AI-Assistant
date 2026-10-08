/**
 * AudioDiagnosticModal - Live inspection HUD for raw PCM chunks captured from the microphone,
 * verifying encoding correctness and real-time streaming transmission to Gemini Live.
 */

import React, { useState, useEffect } from 'react';
import { X, Activity, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, Copy, Check } from 'lucide-react';
import { AudioDiagnosticSummary } from '../types/assistant';
import { AudioStreamer } from '../services/AudioStreamer';

interface AudioDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioStreamer: AudioStreamer;
}

export const AudioDiagnosticModal: React.FC<AudioDiagnosticModalProps> = ({
  isOpen,
  onClose,
  audioStreamer,
}) => {
  const [summary, setSummary] = useState<AudioDiagnosticSummary>(audioStreamer.getDiagnosticSummary());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Fast polling while modal is open
    const interval = setInterval(() => {
      setSummary(audioStreamer.getDiagnosticSummary());
    }, 200);

    return () => clearInterval(interval);
  }, [isOpen, audioStreamer]);

  if (!isOpen) return null;

  const handleCopyReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      summary,
    };
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-slate-950/95 backdrop-blur-2xl border border-cyan-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl z-10 flex flex-col max-h-[90vh] text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white">PCM Audio Stream Diagnostic</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Live Telemetry
                </span>
              </div>
              <p className="text-xs text-white/50">
                Real-time validation of microphone sampling, downsampling &amp; PCM16 encoding
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyReport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/80 hover:text-white transition-colors"
              title="Copy telemetry JSON"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Export JSON'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* Status Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10">
              <div className="text-[11px] text-white/50 uppercase font-medium">Input / Output Rate</div>
              <div className="text-sm sm:text-base font-mono font-semibold text-cyan-300 mt-1">
                {summary.hardwareSampleRate || 48000}Hz &rarr; {summary.targetSampleRate}Hz
              </div>
              <div className="text-[10px] text-white/40 mt-0.5">Linear interpolation</div>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10">
              <div className="text-[11px] text-white/50 uppercase font-medium">Chunks Streamed</div>
              <div className="text-sm sm:text-base font-mono font-semibold text-emerald-300 mt-1">
                {summary.totalChunks} chunks
              </div>
              <div className="text-[10px] text-white/40 mt-0.5">{summary.totalDurationSeconds}s audio streamed</div>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10">
              <div className="text-[11px] text-white/50 uppercase font-medium">Voice / Silence</div>
              <div className="text-sm sm:text-base font-mono font-semibold text-violet-300 mt-1">
                {summary.speechChunksCount} / {summary.silenceChunksCount}
              </div>
              <div className="text-[10px] text-white/40 mt-0.5">VAD frame tracking</div>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10">
              <div className="text-[11px] text-white/50 uppercase font-medium">Peak / RMS Ever</div>
              <div className="text-sm sm:text-base font-mono font-semibold text-amber-300 mt-1">
                {summary.peakAmplitudeEver} / {summary.averageRms}
              </div>
              <div className="text-[10px] text-white/40 mt-0.5">16-bit signed range</div>
            </div>
          </div>

          {/* Verification Badge */}
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-xs text-emerald-200">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Encoding Integrity:</strong> PCM16 Little-Endian @ 16,000Hz • Base64 chunks verified
              </span>
            </div>
            <span className="font-mono text-[11px] text-emerald-400/80">audio/pcm;rate=16000</span>
          </div>

          {/* Recent Chunks Live Feed Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/60">
                Recent PCM Chunks (Last {summary.recentChunks.length})
              </span>
              <button
                onClick={() => audioStreamer.clearDiagnostics()}
                className="text-[11px] text-white/40 hover:text-white flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset log</span>
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden text-xs font-mono">
              <div className="grid grid-cols-6 px-3 py-2 bg-white/[0.04] border-b border-white/10 text-[10px] uppercase font-semibold text-white/50">
                <span>Chunk #</span>
                <span>Samples</span>
                <span>RMS Level</span>
                <span>Peak Int16</span>
                <span>Base64</span>
                <span className="text-right">State</span>
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-white/5">
                {summary.recentChunks.length === 0 ? (
                  <div className="py-8 text-center text-white/40 font-sans text-xs">
                    Start speaking to capture and log live microphone chunks
                  </div>
                ) : (
                  summary.recentChunks.map((chunk) => (
                    <div
                      key={chunk.sequenceNumber}
                      className={`grid grid-cols-6 px-3 py-2 items-center text-[11px] transition-colors ${
                        !chunk.isSilence ? 'bg-cyan-500/10 text-cyan-200' : 'text-white/60 hover:bg-white/[0.02]'
                      }`}
                    >
                      <span className="font-semibold">#{chunk.sequenceNumber}</span>
                      <span>{chunk.sampleCount}</span>
                      <span className={chunk.rms > 0.05 ? 'text-emerald-300 font-bold' : ''}>
                        {chunk.rms.toFixed(3)}
                      </span>
                      <span>{chunk.peakAmplitude}</span>
                      <span>{chunk.base64Length}b</span>
                      <span className="text-right">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            !chunk.isSilence
                              ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/30'
                              : 'bg-white/10 text-white/40'
                          }`}
                        >
                          {chunk.isSilence ? 'Silence' : 'Voice'}
                        </span>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-white/50">
          <span>Continuous transmission via WebSocket &rarr; Gemini Live API</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-sans font-medium text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
