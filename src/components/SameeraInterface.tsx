/**
 * SameeraInterface - Futuristic dark glassmorphic interface for Sameera voice AI assistant.
 * Pure voice-to-voice interaction (NO text chat interface), central animated power/mic button,
 * dynamic audio-reactive visuals, live mic volume meter, ethereal speech bubbles, and instant tool actions.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Mic,
  MicOff,
  Power,
  Sparkles,
  StickyNote,
  AlertCircle,
  HelpCircle,
  Radio,
  Volume2,
  Activity,
  UserCheck,
  RotateCw,
} from 'lucide-react';
import { AssistantState, VisualTheme, VisualizerMode, ToolExecutionEvent, MediaViewerState, ArticleReaderState, ArticleSearchState } from '../types/assistant';
import { AudioPlayer } from '../services/AudioPlayer';
import { AudioStreamer } from '../services/AudioStreamer';
import { ToolManager } from '../services/ToolManager';
import { LiveSession } from '../services/LiveSession';
import { StateManager, AppState } from '../services/StateManager';
import { THEMES } from '../utils/themeStyles';
import { EMOTION_PALETTES, detectEmotionalState } from '../utils/emotionAnalyzer';
import { DynamicVisualizer } from './DynamicVisualizer';
import { ToolActionToast } from './ToolActionToast';
import { SessionMemoDrawer } from './SessionMemoDrawer';
import { ThemeSelectorModal } from './ThemeSelectorModal';
import { AudioDiagnosticModal } from './AudioDiagnosticModal';
import { InAppMediaModal } from './InAppMediaModal';
import { ArticleReaderModal } from './ArticleReaderModal';
import { ArticleSourcesModal } from './ArticleSourcesModal';
import { GmailPanel } from './GmailPanel';

export const SameeraInterface: React.FC = () => {
  // Instantiate singleton services
  const streamer = useMemo(() => new AudioStreamer(), []);
  const player = useMemo(() => new AudioPlayer(), []);
  const toolManager = useMemo(() => new ToolManager(), []);
  const stateManager = useMemo(() => new StateManager(), []);
  const liveSession = useMemo(
    () => new LiveSession(streamer, player, toolManager),
    [streamer, player, toolManager]
  );
  useEffect(() => {
    const notify = () => liveSession.notifyGmailUpdated();
    window.addEventListener('sameera-mail-result', notify);
    return () => window.removeEventListener('sameera-mail-result', notify);
  }, [liveSession]);

  // Observable state
  const [appState, setAppState] = useState<AppState>(stateManager.getState());
  const [isMemoOpen, setIsMemoOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [contextNotification, setContextNotification] = useState<string | null>(null);
  const [currentToolEvent, setCurrentToolEvent] = useState<ToolExecutionEvent | null>(null);
  const [mediaViewer, setMediaViewer] = useState<MediaViewerState | null>(null);
  const [articleReader, setArticleReader] = useState<ArticleReaderState | null>(null);
  const [articleSearch, setArticleSearch] = useState<ArticleSearchState | null>(null);

  // Live mic meter & spoken captions
  const [micAudioLevel, setMicAudioLevel] = useState<number>(0);
  const [liveCaption, setLiveCaption] = useState<{ role: 'user' | 'assistant'; text: string } | null>(null);
  const captionTimeoutRef = useRef<any>(null);

  // Subscribe to StateManager
  useEffect(() => {
    const unsubscribe = stateManager.subscribe((newState) => {
      setAppState(newState);
    });
    return unsubscribe;
  }, [stateManager]);

  // Wire LiveSession & ToolManager callbacks
  useEffect(() => {
    liveSession.onStateChange = (state) => {
      stateManager.setAssistantState(state);
    };

    liveSession.onError = (errorMsg) => {
      stateManager.setErrorMessage(errorMsg);
    };

    liveSession.onContextRefreshed = () => {
      setContextNotification(
        stateManager.getLanguage() === 'telugu'
          ? 'సంభాషణ సందర్భం స్వయంచాలకంగా తాజాకరించబడింది'
          : 'Context smoothly compacted & re-anchored'
      );
      setTimeout(() => setContextNotification(null), 4000);
    };

    liveSession.onTranscription = ({ role, text }) => {
      setLiveCaption((prev) => {
        if (prev && prev.role === role) {
          return { role, text: prev.text + ' ' + text };
        }
        return { role, text };
      });

      // Predict emotional state dynamically from Sameera's speech
      if (role === 'assistant' && text) {
        const nextEmotion = detectEmotionalState(text, stateManager.getState().emotionalState);
        stateManager.setEmotionalState(nextEmotion);
      }

      // Record dialogue turn into active session buffer for local memory persistence
      stateManager.recordDialogueTurn(role, text);

      if (captionTimeoutRef.current) {
        clearTimeout(captionTimeoutRef.current);
      }
      captionTimeoutRef.current = setTimeout(() => {
        setLiveCaption(null);
      }, 7000);
    };

    toolManager.setCallbacks({
      onToolEvent: (event) => {
        stateManager.setLastToolEvent(event);
        setCurrentToolEvent(event);
      },
      onThemeChange: (theme) => {
        stateManager.setVisualTheme(theme);
      },
      onNotesChange: (notes) => {
        stateManager.setNotes(notes);
      },
      onMediaOpen: (media) => {
        setMediaViewer(media);
      },
      onArticleReader: (reader) => {
        setArticleReader(reader);
        setArticleSearch(null);
      },
      onArticleSearch: setArticleSearch,
    });

    stateManager.setNotes(toolManager.getNotes());

    // Live volume polling for UI meter
    const meterInterval = setInterval(() => {
      if (streamer.getIsStreaming()) {
        setMicAudioLevel(streamer.getAudioLevel());
      } else {
        setMicAudioLevel(0);
      }
    }, 100);

    return () => {
      clearInterval(meterInterval);
      if (captionTimeoutRef.current) clearTimeout(captionTimeoutRef.current);
      liveSession.stop();
      player.destroy();
    };
  }, [liveSession, toolManager, stateManager, streamer, player]);

  const {
    assistantState,
    emotionalState,
    visualTheme,
    visualizerMode,
    language,
    isMuted,
    notes,
    errorMessage,
    sessionDuration,
  } = appState;

  const currentTheme = THEMES[visualTheme] || THEMES['midnight-violet'];
  const currentEmotion = EMOTION_PALETTES[emotionalState || 'neutral'];

  // Toggle session connection
  const handleToggleConnection = async () => {
    stateManager.setErrorMessage(null);

    if (assistantState === 'disconnected') {
      try {
        // Unlock Web Audio immediately within the synchronous click gesture!
        await liveSession.unlockAudio();
        // Load formatted previous conversation memories from LocalStorage
        const memoryContext = stateManager.getFormattedMemoryContext();
        await liveSession.start(memoryContext, language);
      } catch (err: any) {
        stateManager.setErrorMessage(
          err?.message || 'Failed to start session. Please allow microphone access.'
        );
      }
    } else {
      liveSession.stop();
    }
  };

  // Toggle microphone mute
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    liveSession.setMuted(nextMuted);
    stateManager.setIsMuted(nextMuted);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const statusConfig = {
    disconnected: {
      label: language === 'telugu' ? 'సిద్ధంగా ఉంది' : 'Standby',
      badgeBg: 'bg-white/10 text-white/60 border-white/15',
      subtext: language === 'telugu' ? 'సమీరాను ప్రారంభించడానికి కోర్ బటన్ నొక్కండి' : 'Tap the core to wake Sameera up',
      pulseColor: 'bg-white/40',
    },
    connecting: {
      label: language === 'telugu' ? 'కనెక్ట్ అవుతోంది...' : 'Connecting',
      badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      subtext: language === 'telugu' ? 'వాయిస్ లింక్ కనెక్ట్ అవుతోంది...' : 'Establishing ultra-low latency voice link...',
      pulseColor: 'bg-cyan-400 animate-ping',
    },
    listening: {
      label: isMuted
        ? (language === 'telugu' ? 'మైక్ మ్యూట్ చేయబడింది' : 'Mic Muted')
        : (language === 'telugu' ? 'తెలుగు వాయిస్ యాక్టివ్' : 'Direct Voice Active'),
      badgeBg: isMuted
        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      subtext: isMuted
        ? (language === 'telugu' ? 'మైక్ పాజ్ చేయబడింది. మాట్లాడటానికి రెజ్యూమ్ చేయండి.' : 'Microphone is paused. Click Resume Voice to continue.')
        : (language === 'telugu' ? "వినడానికి సిద్ధంగా ఉంది • 'హే సమీరా' అనండి లేదా తెలుగులో మాట్లాడండి" : "Listening for you • Say 'Hey Sameera' or chat • Silently filters room chatter"),
      pulseColor: isMuted ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse',
    },
    thinking: {
      label: language === 'telugu' ? 'ఆలోచిస్తోంది...' : 'Thinking...',
      badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40 animate-pulse',
      subtext: language === 'telugu' ? 'మీ అభ్యర్థనను సిద్ధం చేస్తోంది...' : 'Processing your thoughts...',
      pulseColor: 'bg-cyan-400 animate-ping',
    },
    speaking: {
      label: language === 'telugu' ? 'సమీరా మాట్లాడుతోంది' : 'Sameera Speaking',
      badgeBg: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
      subtext: language === 'telugu' ? 'సమీరా మాట్లాడుతోంది... మధ్యలో ఎప్పుడైనా మాట్లాడవచ్చు.' : 'Sameera is speaking... Speak to naturally interrupt.',
      pulseColor: 'bg-violet-400 animate-ping',
    },
  }[assistantState];

  return (
    <div
      className={`relative w-full h-screen overflow-hidden select-none bg-gradient-to-b ${currentTheme.bgGradient} font-sans text-white transition-colors duration-700 flex flex-col justify-between`}
    >
      {/* Dynamic 60fps Audio Visualizer Canvas */}
      <DynamicVisualizer
        state={assistantState}
        theme={visualTheme}
        mode={visualizerMode}
        emotionalState={emotionalState}
        audioPlayer={player}
        audioStreamer={streamer}
      />

      {/* Floating Ambient Atmosphere Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-violet-600/10 via-cyan-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-40 flex items-center justify-between px-5 sm:px-8 py-5">
        {/* Assistant Branding & Persona */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-lg">
            <Radio className="w-5 h-5 text-white/90" />
            <span
              className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${
                assistantState === 'disconnected' ? 'bg-white/40' : 'bg-emerald-400 animate-ping'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-white/90 to-white/60 bg-clip-text text-transparent font-['Space_Grotesk']">
                SAMEERA
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-white/10 text-white/70 border border-white/15">
                Live Voice AI
              </span>
              {assistantState !== 'disconnected' && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide border transition-all duration-700 animate-in fade-in ${currentEmotion.badgeClass}`}
                  title={`Sameera's Mood: ${currentEmotion.name}`}
                >
                  {currentEmotion.badgeLabel}
                </span>
              )}
            </div>
            <p className="text-[11px] text-white/50 tracking-wide">
              Witty • Charming • Expressive
            </p>
          </div>
        </div>

        {/* Center Live Status & Audio Meter */}
        <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-full bg-white/[0.06] backdrop-blur-xl border border-white/15 shadow-sm">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${statusConfig.pulseColor}`} />
            <span className="text-xs font-medium tracking-wide text-white/90">
              {statusConfig.label}
            </span>
          </div>

          {/* Direct Focus indicator */}
          {assistantState !== 'disconnected' && !isMuted && (
            <div
              className="flex items-center gap-1.5 border-l border-white/15 pl-2.5 text-[11px] text-cyan-300 font-medium"
              title="Sameera stays silent during third-party chatter and waits for 'Hey Sameera'"
            >
              <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden lg:inline">Filters Room Chatter</span>
            </div>
          )}

          {/* Live Mic Activity Visualizer Bars */}
          {assistantState === 'listening' && !isMuted && (
            <div className="flex items-center gap-0.5 border-l border-white/15 pl-2.5" title="Mic Activity Level">
              {[0.1, 0.3, 0.5, 0.7].map((threshold, idx) => (
                <div
                  key={idx}
                  className={`w-1 rounded-full transition-all duration-75 ${
                    micAudioLevel >= threshold
                      ? 'bg-emerald-400 h-3.5 shadow-[0_0_8px_#34d399]'
                      : 'bg-white/20 h-1.5'
                  }`}
                />
              ))}
            </div>
          )}

          {assistantState !== 'disconnected' && (
            <span className="text-xs font-mono text-white/40 border-l border-white/10 pl-2">
              {formatTime(sessionDuration)}
            </span>
          )}
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Quick Language Toggle & Menu */}
          <div className="relative">
            <button
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-gradient-to-r from-cyan-500/15 to-violet-500/15 hover:from-cyan-500/25 hover:to-violet-500/25 backdrop-blur-xl border border-cyan-400/30 text-white transition-all text-xs font-semibold shadow-sm"
              title="Select Language: Telugu (తెలుగు), Bilingual, English"
              aria-label="Select voice language"
              aria-expanded={isLangMenuOpen}
              aria-controls="voice-language-options"
            >
              <span>{language === 'telugu' ? '🇮🇳' : language === 'bilingual' ? '🌐' : '🇬🇧'}</span>
              <span className="font-['Space_Grotesk']">
                {language === 'telugu' ? 'తెలుగు' : language === 'bilingual' ? 'ద్వంద్వ (Bilingual)' : 'English'}
              </span>
              <span className="text-[10px] text-white/50">▼</span>
            </button>

            {/* Language Selection Dropdown Menu */}
            {isLangMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsLangMenuOpen(false)}
                />
                <div id="voice-language-options" aria-label="Voice languages" onKeyDown={(event) => { if (event.key === 'Escape') setIsLangMenuOpen(false); }} className="absolute right-0 mt-2 w-64 p-2 rounded-2xl bg-slate-950/95 backdrop-blur-2xl border border-white/20 shadow-2xl z-50 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-white/40 border-b border-white/10 mb-1">
                    Select Voice Language
                  </div>
                  {[
                    { id: 'telugu', label: 'తెలుగు (Telugu)', sub: 'పూర్తి తెలుగు సంభాషణ', flag: '🇮🇳' },
                    { id: 'bilingual', label: 'ద్వంద్వ (Bilingual)', sub: 'Telugu + English (Tenglish)', flag: '🌐' },
                    { id: 'english', label: 'English', sub: 'Global English voice', flag: '🇬🇧' },
                  ].map((opt) => {
                    const isSelected = language === opt.id;
                    return (
                      <button
                        key={opt.id}
                        aria-pressed={isSelected}
                        onClick={() => {
                          stateManager.setLanguage(opt.id as any);
                          liveSession.setLanguage(opt.id as any);
                          setIsLangMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all ${
                          isSelected
                            ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 text-white font-medium border border-cyan-400/40 shadow-sm'
                            : 'hover:bg-white/10 text-white/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">{opt.flag}</span>
                          <div>
                            <div className="text-xs font-semibold">{opt.label}</div>
                            <div className="text-[10px] text-white/50">{opt.sub}</div>
                          </div>
                        </div>
                        {isSelected && <span className="text-cyan-400 text-xs">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setIsMemoOpen(true)}
            className="relative p-2.5 rounded-2xl bg-white/[0.07] hover:bg-white/[0.12] backdrop-blur-xl border border-white/15 text-white/80 hover:text-white transition-all"
            title="Conversation Memories & Notes"
          >
            <StickyNote className="w-4 h-4" />
            {(notes.length > 0 || appState.memories.length > 0) && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-violet-500 text-[9px] font-bold flex items-center justify-center text-white shadow-sm">
                {notes.length + appState.memories.length}
              </span>
            )}
          </button>

          {/* Quick Context Re-anchor Button (Active during calls to prevent loop/bloat) */}
          {assistantState !== 'disconnected' && (
            <button
              onClick={() => {
                liveSession.refreshContext();
                setContextNotification(
                  language === 'telugu'
                    ? 'సందర్భం రీసెట్ చేయబడుతోంది...'
                    : 'Re-anchoring conversation context...'
                );
                setTimeout(() => setContextNotification(null), 3500);
              }}
              className="p-2.5 rounded-2xl bg-cyan-500/15 hover:bg-cyan-500/25 backdrop-blur-xl border border-cyan-400/30 text-cyan-300 hover:text-cyan-200 transition-all shadow-sm"
              title={
                language === 'telugu'
                  ? 'సందర్భాన్ని రీ-యాంకర్ చేయండి (స్టట్టర్ లేదా రిపీట్ నివారణ)'
                  : 'Re-anchor conversation context (clears loops & audio bloat)'
              }
            >
              <RotateCw className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setIsThemeModalOpen(true)}
            className="p-2.5 rounded-2xl bg-white/[0.07] hover:bg-white/[0.12] backdrop-blur-xl border border-white/15 text-white/80 hover:text-white transition-all"
            title="Visuals & Theme"
          >
            <Sparkles className="w-4 h-4" />
          </button>

          {/* Audio Diagnostics HUD */}
          <GmailPanel />
          <button
            onClick={() => setIsDiagnosticOpen(true)}
            className="p-2.5 rounded-2xl bg-white/[0.07] hover:bg-white/[0.12] backdrop-blur-xl border border-white/15 text-cyan-400 hover:text-cyan-300 transition-all"
            title="PCM Audio Stream Diagnostics"
          >
            <Activity className="w-4 h-4 animate-pulse" />
          </button>

          <button
            onClick={() => setIsHelpOpen(true)}
            className="p-2.5 rounded-2xl bg-white/[0.07] hover:bg-white/[0.12] backdrop-blur-xl border border-white/15 text-white/80 hover:text-white transition-all"
            title="What can Sameera do?"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Context Compaction Toast Banner */}
      {contextNotification && (
        <div className="relative z-30 mx-auto max-w-md w-[90%] px-4 py-2.5 rounded-2xl bg-cyan-950/80 backdrop-blur-xl border border-cyan-400/40 shadow-xl flex items-center justify-between gap-3 text-xs text-cyan-200 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <RotateCw className="w-4 h-4 text-cyan-400 animate-spin" />
            <span>{contextNotification}</span>
          </div>
          <button
            onClick={() => setContextNotification(null)}
            className="text-cyan-400/70 hover:text-cyan-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="relative z-30 mx-auto max-w-lg w-[92%] px-4 py-3 rounded-2xl bg-rose-950/80 backdrop-blur-xl border border-rose-500/40 shadow-xl flex items-center justify-between gap-3 text-xs text-rose-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="line-clamp-2">{errorMessage}</span>
          </div>
          <button
            onClick={() => stateManager.setErrorMessage(null)}
            className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-medium shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Central Interaction Stage */}
      <main className="relative z-20 flex-1 flex flex-col items-center justify-center px-4 text-center">
        {/* Mobile Status Pill & Meter */}
        <div className="flex md:hidden items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.06] backdrop-blur-xl border border-white/15 shadow-sm mb-4">
          <span className={`w-2 h-2 rounded-full ${statusConfig.pulseColor}`} />
          <span className="text-xs font-medium text-white/90">{statusConfig.label}</span>
          {assistantState !== 'disconnected' && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium border ${currentEmotion.badgeClass}`}>
              {currentEmotion.badgeLabel}
            </span>
          )}
          {assistantState === 'listening' && !isMuted && (
            <div className="flex items-center gap-0.5 border-l border-white/15 pl-2">
              {[0.15, 0.4, 0.7].map((threshold, idx) => (
                <div
                  key={idx}
                  className={`w-1 rounded-full transition-all duration-75 ${
                    micAudioLevel >= threshold
                      ? 'bg-emerald-400 h-2.5 shadow-sm'
                      : 'bg-white/20 h-1'
                  }`}
                />
              ))}
            </div>
          )}
          {assistantState !== 'disconnected' && (
            <span className="text-xs font-mono text-white/40 border-l border-white/10 pl-2">
              {formatTime(sessionDuration)}
            </span>
          )}
        </div>

        {/* Floating Ethereal Subtitle / Speech Caption Bubble */}
        {liveCaption && (
          <div className="mb-4 max-w-md w-[90%] px-4 py-2 rounded-2xl bg-white/[0.08] backdrop-blur-2xl border border-white/20 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider block mb-0.5 ${
                liveCaption.role === 'user' ? 'text-cyan-300' : 'text-violet-300'
              }`}
            >
              {liveCaption.role === 'user' ? 'You Spoke' : 'Sameera'}
            </span>
            <p className="text-xs sm:text-sm font-medium text-white/90 italic leading-relaxed">
              &ldquo;{liveCaption.text}&rdquo;
            </p>
          </div>
        )}

        {/* Central Core Animated Button */}
        <div className="relative group my-auto">
          {/* Subtle Thinking Orbital Indicator */}
          {assistantState === 'thinking' && (
            <div className="absolute -inset-6 sm:-inset-8 pointer-events-none z-10 flex items-center justify-center">
              {/* Diffuse thinking glow */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500/25 via-violet-500/25 to-pink-500/25 blur-2xl animate-pulse" />

              {/* Rotating outer dash ring */}
              <div className="absolute inset-0 rounded-full border border-dashed border-cyan-400/50 animate-spin duration-7000" />

              {/* Dual-tone neural gradient ring */}
              <div className="absolute inset-2 sm:inset-3 rounded-full border-2 border-transparent border-t-cyan-300 border-b-violet-400 animate-spin duration-2500" />

              {/* Orbiting quantum light beads */}
              <div className="absolute inset-0 rounded-full animate-spin duration-3000">
                <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-cyan-300 shadow-[0_0_12px_#38bdf8]" />
              </div>
              <div className="absolute inset-0 rounded-full animate-spin duration-4000 [animation-direction:reverse]">
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2.5 h-2.5 rounded-full bg-violet-300 shadow-[0_0_10px_#c084fc]" />
              </div>
            </div>
          )}

          {/* Pulsing Aura Rings */}
          <div
            className={`absolute -inset-8 rounded-full transition-opacity duration-700 pointer-events-none ${
              assistantState === 'speaking'
                ? 'opacity-80 animate-ping duration-1000'
                : assistantState === 'listening'
                ? 'opacity-60 animate-pulse duration-700'
                : assistantState === 'thinking'
                ? 'opacity-70 animate-pulse duration-1000'
                : 'opacity-20 group-hover:opacity-40'
            }`}
            style={{
              backgroundColor: currentTheme.canvasColors.orbGlow,
              filter: 'blur(35px)',
            }}
          />

          {/* Interactive Core Trigger */}
          <button
            onClick={handleToggleConnection}
            className={`relative w-44 h-44 sm:w-56 sm:h-56 rounded-full flex flex-col items-center justify-center p-6 transition-all duration-500 cursor-pointer shadow-2xl focus:outline-none ${
              assistantState === 'disconnected'
                ? 'bg-gradient-to-b from-white/15 to-white/5 border-2 border-white/20 hover:scale-105 hover:border-white/40'
                : assistantState === 'connecting'
                ? 'bg-gradient-to-b from-cyan-500/20 to-cyan-950/40 border-2 border-cyan-400/60 animate-pulse'
                : assistantState === 'listening'
                ? 'bg-gradient-to-b from-emerald-500/20 to-teal-950/40 border-2 border-emerald-400/60 hover:scale-[1.02]'
                : assistantState === 'thinking'
                ? 'bg-gradient-to-b from-cyan-500/30 via-violet-900/40 to-slate-950/70 border-2 border-cyan-400/70 hover:scale-[1.02]'
                : 'bg-gradient-to-b from-violet-500/30 to-purple-950/50 border-2 border-violet-400/80 hover:scale-[1.02]'
            }`}
            style={{
              boxShadow:
                assistantState !== 'disconnected'
                  ? `0 0 60px ${currentTheme.canvasColors.orbGlow}`
                  : '0 0 35px rgba(255,255,255,0.08)',
            }}
            aria-label={assistantState === 'disconnected' ? 'Start Sameera Voice Session' : 'End Voice Session'}
          >
            {/* Inner Rotating Ring for Connecting */}
            {assistantState === 'connecting' && (
              <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin" />
            )}

            {/* Icon */}
            <div className="mb-2 transition-transform duration-300 group-hover:scale-110">
              {assistantState === 'disconnected' ? (
                <Power className="w-12 h-12 sm:w-16 sm:h-16 text-white/80 group-hover:text-white" />
              ) : isMuted ? (
                <MicOff className="w-12 h-12 sm:w-16 sm:h-16 text-amber-400" />
              ) : assistantState === 'thinking' ? (
                <Sparkles className="w-12 h-12 sm:w-16 sm:h-16 text-cyan-300 animate-pulse" />
              ) : (
                <Mic className="w-12 h-12 sm:w-16 sm:h-16 text-white animate-pulse" />
              )}
            </div>

            {/* Action Text inside button */}
            <span className="text-xs sm:text-sm font-semibold tracking-wider uppercase text-white/80 group-hover:text-white font-['Space_Grotesk']">
              {assistantState === 'disconnected'
                ? (language === 'telugu' ? 'సమీరాను ప్రారంభించు' : 'Awaken Sameera')
                : assistantState === 'connecting'
                ? (language === 'telugu' ? 'కనెక్ట్ అవుతోంది...' : 'Connecting...')
                : assistantState === 'thinking'
                ? (language === 'telugu' ? 'ఆలోచిస్తోంది...' : 'Thinking...')
                : (language === 'telugu' ? 'వాయిస్ యాక్టివ్' : 'Active Voice')}
            </span>

            <span className="text-[10px] text-white/50 mt-1">
              {assistantState === 'disconnected'
                ? (language === 'telugu' ? 'ప్రారంభించడానికి నొక్కండి' : 'Tap to start')
                : assistantState === 'thinking'
                ? (language === 'telugu' ? 'ప్రాసెస్ అవుతోంది...' : 'Processing...')
                : (language === 'telugu' ? 'ఆపడానికి నొక్కండి' : 'Tap to stop')}
            </span>
          </button>
        </div>

        {/* Spoken State Description & Prompts */}
        <div className="mt-8 max-w-md space-y-2">
          <p className="text-sm sm:text-base font-medium text-white/90 transition-all">
            {statusConfig.subtext}
          </p>

          {/* Quick inspiration chips */}
          {assistantState === 'disconnected' ? (
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
              <span className="text-[11px] text-white/40">
                {language === 'telugu' ? 'ఇలా అడగండి:' : 'Try saying:'}
              </span>
              {(language === 'telugu'
                ? [
                    'హే సమీరా, ఎలా ఉన్నావ్?',
                    'యూట్యూబ్‌లో తెలుగు పాటలు పెట్టు',
                    'నాకోసం ఒక కథ చెప్పు సమీరా',
                    'ఈ ఆర్టికల్ చదువు',
                    'ఈరోజు విశేషాలు ఏంటి?',
                  ]
                : language === 'bilingual'
                ? [
                    'హే సమీరా, how are you?',
                    'యూట్యూబ్‌లో Telugu songs పెట్టు',
                    'Tell me a story in Telugu',
                    'ఈ ఆర్టికల్ చదువు Sameera',
                    'What projects can you help with?',
                  ]
                : [
                    'Hey Sameera, what can you do?',
                    'Open YouTube lo-fi beats',
                    'Read an article for me',
                    'Set speaker volume to 35 percent',
                    'Open my report in Word',
                  ]
              ).map((suggestion, idx) => (
                <span
                  key={idx}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-white/60"
                >
                  &ldquo;{suggestion}&rdquo;
                </span>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
              <span className="text-[11px] text-white/40">
                {language === 'telugu' ? 'నేరుగా మాట్లాడండి:' : 'Direct speech:'}
              </span>
              {(language === 'telugu'
                ? [
                    'హే సమీరా, ఇది చేయగలవా?',
                    'ఒక్క నిమిషం ఆగు సమీరా',
                    'హే సమీరా, నేను వచ్చేశాను',
                    'యూట్యూబ్‌లో వీడియో పెట్టు',
                    'ఈ కథ చదువు సమీరా',
                  ]
                : language === 'bilingual'
                ? [
                    'హే సమీరా, can you do this?',
                    'Hold on a sec, Sameera',
                    'హే సమీరా, I am back',
                    'యూట్యూబ్‌లో video ఓపెన్ చేయి',
                    'Read this story for me',
                  ]
                : [
                    'Hey Sameera, can you...',
                    'Hold on a sec, Sameera',
                    "Hey Sameera, I'm back",
                    'Open a YouTube video',
                    'Read this article for me',
                  ]
              ).map((suggestion, idx) => (
                <span
                  key={idx}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-white/50"
                >
                  {suggestion}
                </span>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Floating Bottom Navigation / Control Deck */}
      <footer className="relative z-20 px-5 sm:px-8 py-5">
        <div className="mx-auto max-w-xl w-full flex items-center justify-between p-2.5 sm:p-3 rounded-3xl bg-slate-950/70 backdrop-blur-2xl border border-white/15 shadow-2xl">
          {/* Mute Button */}
          <button
            onClick={handleToggleMute}
            disabled={assistantState === 'disconnected'}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-medium transition-all ${
              assistantState === 'disconnected'
                ? 'opacity-40 cursor-not-allowed text-white/40'
                : isMuted
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
            }`}
            title={isMuted ? 'Resume listening to your voice' : 'Pause mic while talking with roommate or friends'}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span className="hidden sm:inline">{isMuted ? 'Resume Voice' : 'Pause (Roommate/Mute)'}</span>
          </button>

          {/* Visualizer Mode Quick Selector */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/10">
            {(['orb', 'waveform', 'frequency-ring', 'nebula'] as VisualizerMode[]).map((m) => {
              const active = visualizerMode === m;
              return (
                <button
                  key={m}
                  onClick={() => stateManager.setVisualizerMode(m)}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] capitalize font-medium transition-all ${
                    active
                      ? 'bg-white/20 text-white shadow-sm'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                  title={`${m} mode`}
                >
                  {m === 'frequency-ring' ? 'Equalizer' : m}
                </button>
              );
            })}
          </div>

          {/* End Call / Connect Toggle */}
          <button
            onClick={handleToggleConnection}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold tracking-wide transition-all ${
              assistantState === 'disconnected'
                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 shadow-sm'
            }`}
          >
            <Power className="w-4 h-4" />
            <span className="hidden sm:inline">
              {assistantState === 'disconnected' ? 'Start' : 'End Call'}
            </span>
          </button>
        </div>
      </footer>

      {/* Real-time Tool Action Floating Toast */}
      <ToolActionToast
        event={currentToolEvent}
        onDismiss={() => setCurrentToolEvent(null)}
      />

      {/* Floating On-Screen Media Stage (YouTube / Web) */}
      <InAppMediaModal
        media={mediaViewer}
        onClose={() => setMediaViewer(null)}
      />

      {/* Distraction-Free Article & Novel Voice Reader Modal */}
      <ArticleReaderModal
        reader={articleReader}
        onClose={() => { setArticleReader(null); toolManager.closeArticle(); }}
        onFocusParagraph={(paragraph, selectedText) => toolManager.focusArticle(paragraph, selectedText)}
      />

      <ArticleSourcesModal
        search={articleSearch}
        onClose={() => { setArticleSearch(null); toolManager.dismissArticleSearch(); }}
        onChoose={async (id) => {
          const result = await toolManager.selectArticle(id);
          if (!result.success) throw new Error(result.message || 'Could not read this source');
          liveSession.notifyArticleOpened(result);
        }}
      />

      {/* Session Memo Board Drawer */}
      <SessionMemoDrawer
        isOpen={isMemoOpen}
        onClose={() => setIsMemoOpen(false)}
        notes={notes}
        memories={appState.memories}
        onDeleteNote={(id) => toolManager.deleteNote(id)}
        onClearAllNotes={() => toolManager.clearNotes()}
        onDeleteMemory={(id) => stateManager.deleteMemory(id)}
        onClearAllMemories={() => stateManager.clearAllMemories()}
      />

      {/* Appearance & Themes Modal */}
      <ThemeSelectorModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
        currentTheme={visualTheme}
        onSelectTheme={(t) => stateManager.setVisualTheme(t)}
        currentMode={visualizerMode}
        onSelectMode={(m) => stateManager.setVisualizerMode(m)}
        currentLanguage={language}
        onSelectLanguage={(l) => {
          stateManager.setLanguage(l);
          liveSession.setLanguage(l);
        }}
      />

      {/* PCM Audio Stream Diagnostics HUD Modal */}
      <AudioDiagnosticModal
        isOpen={isDiagnosticOpen}
        onClose={() => setIsDiagnosticOpen(false)}
        audioStreamer={streamer}
      />

      {/* Help & Capabilities Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-md"
            onClick={() => setIsHelpOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-slate-950/95 backdrop-blur-2xl border border-white/15 rounded-3xl p-6 shadow-2xl z-10 space-y-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">About Sameera</h3>
                  <p className="text-xs text-white/50">Your charming real-time conversational AI</p>
                </div>
              </div>
              <button
                onClick={() => setIsHelpOpen(false)}
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-white/80 leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 space-y-1">
                <h4 className="font-semibold text-cyan-300 text-sm flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-cyan-400" />
                  Roommate & Side-Chatter Silence Filter
                </h4>
                <p className="text-white/70">
                  When your friends or roommate talk to you or each other in the room (e.g., asking for keys or food), Sameera stays <strong>100% completely silent</strong>. She will never interrupt your real-world conversations! Once you finish, just say <strong className="text-white">&ldquo;Hey Sameera&rdquo;</strong> (or <strong className="text-white">&ldquo;హే సమీరా&rdquo;</strong> in Telugu) to resume chatting right where you left off.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-violet-500/10 border border-violet-500/20 space-y-1">
                <h4 className="font-semibold text-violet-300 text-sm flex items-center gap-1.5">
                  <span>🇮🇳</span>
                  Telugu & Bilingual Language Modes (తెలుగు భాష)
                </h4>
                <p className="text-white/70">
                  Switch between <strong>తెలుగు (Telugu)</strong>, <strong>ద్వంద్వ (Bilingual / Tenglish)</strong>, and <strong>English</strong> anytime with the top language menu. Sameera speaks warm, natural spoken Telugu, understands Telugu YouTube song requests, and reads Telugu articles aloud!
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <h4 className="font-semibold text-emerald-300 text-sm flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Continuous Stability & Speech Booster
                </h4>
                <p className="text-white/70">
                  Includes low-latency jitter buffering so Sameera&apos;s voice never breaks down or stutters during extended conversations, plus an acoustic voice booster that picks up your microphone effortlessly even at conversational distance.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2">
                <h4 className="font-semibold text-white text-sm">Real-time Browser Actions</h4>
                <ul className="space-y-1.5 text-white/60">
                  <li>• <strong className="text-white">Open YouTube Videos:</strong> &ldquo;Open YouTube lo-fi beats&rdquo; or &ldquo;Open MrBeast on YouTube&rdquo; to launch the video player on your screen.</li>
                  <li>• <strong className="text-white">Read Articles & Novels:</strong> &ldquo;Read this article for me: [link]&rdquo; or &ldquo;Read chapter 1 of this story&rdquo; and Sameera will open reader mode and read it aloud with her expressive voice!</li>
                  <li>• <strong className="text-white">Open Websites:</strong> &ldquo;Sameera, open Wikipedia&rdquo; or GitHub, Spotify, etc.</li>
                  <li>• <strong className="text-white">Web Search:</strong> &ldquo;Search Google for today&apos;s tech news.&rdquo;</li>
                  <li>• <strong className="text-white">Date & Time:</strong> &ldquo;What time and day is it?&rdquo;</li>
                  <li>• <strong className="text-white">Change Theme:</strong> &ldquo;Sameera, switch theme to Cyberpunk or Emerald.&rdquo;</li>
                  <li>• <strong className="text-white">Take Notes:</strong> &ldquo;Take a note to call Alex tomorrow at 10.&rdquo;</li>
                </ul>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                <h4 className="font-semibold text-white text-sm mb-1">Windows Computer Actions</h4>
                <p className="text-white/60">Ask Sameera to open Notepad, VS Code, Chrome, or Word. Say “Open Notepad and neatly write my meeting notes…” to create a separate verified working draft. She asks about unclear details before proceeding. Existing text edits preserve an undo copy.</p>
                <p className="text-white/60 mt-2">For Gmail in Chrome, connect the bridge using the Gmail button. Ask for a draft with an exact recipient and purpose. Sending requires a separate request and your click on the exact-message approval preview.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
                <h4 className="font-semibold text-white text-sm mb-1">Natural Interruptions</h4>
                <p className="text-white/60">
                  You never have to wait for Sameera to finish speaking. Whenever you start talking, she will stop immediately and listen to you.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsHelpOpen(false)}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium text-sm transition-all"
            >
              Got it, let&apos;s talk!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
