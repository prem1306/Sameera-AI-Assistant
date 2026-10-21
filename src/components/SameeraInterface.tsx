import { AgentPanel } from './agent/AgentPanel';
import { LanguageSelector } from './LanguageSelector';
import { HelpModal } from './HelpModal';
/**
 * SameeraInterface - Futuristic dark glassmorphic interface for Sameera voice AI assistant.
 * Pure voice-to-voice interaction (NO text chat interface), central animated power/mic button,
 * dynamic audio-reactive visuals, live mic volume meter, ethereal speech bubbles, and instant tool actions.
 */

import React, { useEffect, useState } from 'react';
import { useAssistantSession } from '../hooks/useAssistantSession';
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
import type { VisualizerMode } from '../types/assistant';
import { THEMES } from '../utils/themeStyles';
import { EMOTION_PALETTES } from '../utils/emotionAnalyzer';
import { DynamicVisualizer } from './DynamicVisualizer';
import { ToolActionToast } from './ToolActionToast';
import { SessionMemoDrawer } from './SessionMemoDrawer';
import { ThemeSelectorModal } from './ThemeSelectorModal';
import { AudioDiagnosticModal } from './AudioDiagnosticModal';
import { InAppMediaModal } from './InAppMediaModal';
import { ArticleReaderModal } from './ArticleReaderModal';
import { ArticleSourcesModal } from './ArticleSourcesModal';
import { GmailPanel } from './GmailPanel';
import { ConnectionsPanel } from './connections/ConnectionsPanel';

export const SameeraInterface: React.FC = () => {
  const {
    capabilities, streamer, player, toolManager, stateManager, liveSession, appState,
    contextNotification, showContextNotification, currentToolEvent, setCurrentToolEvent,
    mediaViewer, setMediaViewer, articleReader, setArticleReader, articleSearch, setArticleSearch,
    micAudioLevel, liveCaption, handleToggleConnection, handleToggleMute,
  } = useAssistantSession();
  const [persona, setPersona] = useState('companion');
  const [localProgress, setLocalProgress] = useState('');
  useEffect(() => {
    const changed = (event: Event) => setPersona((event as CustomEvent<string>).detail);
    const progress = (event: Event) => setLocalProgress((event as CustomEvent<string>).detail);
    window.addEventListener('sameera-persona', changed); window.addEventListener('sameera-local-progress', progress);
    return () => { window.removeEventListener('sameera-persona', changed); window.removeEventListener('sameera-local-progress', progress); };
  }, []);
  const [isMemoOpen, setIsMemoOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);

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
                {capabilities.ready ? capabilities.label : 'Loading features…'}
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
              {persona === 'butler' ? 'Calm • Professional • Precise' : 'Witty • Charming • Expressive'}
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
          <LanguageSelector language={language} onSelect={value => { stateManager.setLanguage(value); liveSession.setLanguage(value); }} />

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
                showContextNotification(
                  language === 'telugu'
                    ? 'సందర్భం రీసెట్ చేయబడుతోంది...'
                    : 'Re-anchoring conversation context...', 3500
                );
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
          {capabilities.gmailBridge && <GmailPanel />}
          {localProgress && <span role="status" className="text-xs text-cyan-200">{localProgress}</span>}
          {capabilities.windowsControls && <ConnectionsPanel onResult={id => liveSession.notifyMcpResult(id)} />}
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
      {capabilities.windowsControls && <div className="relative z-40 px-5 sm:px-8 flex flex-wrap items-center gap-3"><AgentPanel liveSession={liveSession} stateManager={stateManager} player={player} /></div>}
      <p className="relative z-10 text-center text-xs text-white/50 px-5" role="status">
        {capabilities.ready ? (capabilities.windowsControls
          ? 'Windows application · Voice & web · Apps & files · PC controls · Gmail bridge'
          : 'Website · Voice conversations · Web search · Articles & videos') : 'Connecting to Sameera…'}
      </p>

      {/* Context Compaction Toast Banner */}
      {contextNotification && (
        <div className="relative z-30 mx-auto max-w-md w-[90%] px-4 py-2.5 rounded-2xl bg-cyan-950/80 backdrop-blur-xl border border-cyan-400/40 shadow-xl flex items-center justify-between gap-3 text-xs text-cyan-200 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <RotateCw className="w-4 h-4 text-cyan-400 animate-spin" />
            <span>{contextNotification}</span>
          </div>
          <button
            onClick={() => showContextNotification(null)}
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
                    capabilities.windowsControls ? 'Set speaker volume to 35 percent' : 'Tell me a short story',
                    capabilities.windowsControls ? 'Open my report in Word' : 'Explain this article to me',
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
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} capabilities={capabilities} />
    </div>
  );
};
