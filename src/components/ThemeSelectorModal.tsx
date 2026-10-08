/**
 * ThemeSelectorModal - Dialog to switch aesthetic themes and visualizer styles
 */

import React from 'react';
import { X, Sparkles, Activity, Check, Globe } from 'lucide-react';
import { VisualTheme, VisualizerMode, LanguageMode } from '../types/assistant';
import { THEMES } from '../utils/themeStyles';

interface ThemeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: VisualTheme;
  onSelectTheme: (theme: VisualTheme) => void;
  currentMode: VisualizerMode;
  onSelectMode: (mode: VisualizerMode) => void;
  currentLanguage: LanguageMode;
  onSelectLanguage: (language: LanguageMode) => void;
}

const MODES: { id: VisualizerMode; name: string; desc: string }[] = [
  { id: 'orb', name: 'Neural Orb', desc: 'Pulsing holographic core with orbital energy ripples' },
  { id: 'waveform', name: 'Fluid Waves', desc: 'Layered horizontal neon ribbons weaving with audio frequencies' },
  { id: 'frequency-ring', name: 'Equalizer Ring', desc: 'Radial reactive sound bars pulsing outward' },
  { id: 'nebula', name: 'Cosmic Nebula', desc: 'Spiraling particle vortex reacting to vocal timbre' },
];

export const ThemeSelectorModal: React.FC<ThemeSelectorModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onSelectTheme,
  currentMode,
  onSelectMode,
  currentLanguage,
  onSelectLanguage,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-slate-950/95 backdrop-blur-2xl border border-white/15 rounded-3xl p-6 shadow-2xl z-10 space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Appearance & Visuals</h3>
              <p className="text-xs text-white/50">Personalize Sameera&apos;s ambiance and reactive animations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Language Selection */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
              Conversational Language / సంభాషణ భాష
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              { id: 'telugu', label: 'తెలుగు (Telugu)', sub: 'Native Telugu fluency', flag: '🇮🇳' },
              { id: 'bilingual', label: 'Bilingual / Tenglish', sub: 'Telugu + English mix', flag: '🌐' },
              { id: 'english', label: 'English', sub: 'Global English speech', flag: '🇬🇧' },
            ].map((item) => {
              const isSelected = currentLanguage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectLanguage(item.id as LanguageMode)}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? 'bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border-cyan-400/50 shadow-md ring-1 ring-cyan-400/30'
                      : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                      <span>{item.flag}</span>
                      <span>{item.label}</span>
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-white/50">{item.sub}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Themes Grid */}
        <div className="space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
            Aesthetic Themes
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {Object.values(THEMES).map((thm) => {
              const isSelected = currentTheme === thm.id;
              return (
                <button
                  key={thm.id}
                  onClick={() => onSelectTheme(thm.id)}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? 'bg-white/10 border-white/40 shadow-[0_0_25px_rgba(255,255,255,0.15)] ring-1 ring-white/30'
                      : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-5 h-5 rounded-full shrink-0 shadow-sm"
                      style={{
                        backgroundColor: thm.canvasColors.orbCore,
                        boxShadow: `0 0 10px ${thm.canvasColors.orbCore}`,
                      }}
                    />
                    <div>
                      <div className="text-sm font-medium text-white">{thm.name}</div>
                      <div className="text-[11px] text-white/50">{thm.subtitle.split('&')[0]}</div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Visualizer Modes */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-white/60" />
            <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
              Audio Waveform Mode
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {MODES.map((m) => {
              const isSelected = currentMode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => onSelectMode(m.id)}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? 'bg-white/10 border-white/40 shadow-sm ring-1 ring-white/30'
                      : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white">{m.name}</span>
                    {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed">{m.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Done Button */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium text-sm transition-all"
        >
          Apply & Close
        </button>
      </div>
    </div>
  );
};
