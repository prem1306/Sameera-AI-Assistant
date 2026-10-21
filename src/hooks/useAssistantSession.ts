import { LocalActionClient } from '../services/tools/LocalActionClient';
import { useState, useEffect, useMemo, useRef, useCallback, useSyncExternalStore } from 'react';
import { runtimeCapabilities } from '../services/RuntimeCapabilities';
import type { ToolExecutionEvent, MediaViewerState, ArticleReaderState, ArticleSearchState } from '../types/assistant';
import { AudioPlayer } from '../services/AudioPlayer';
import { AudioStreamer } from '../services/AudioStreamer';
import { ToolManager } from '../services/ToolManager';
import { LiveSession } from '../services/LiveSession';
import { StateManager, type AppState } from '../services/StateManager';
import { detectEmotionalState } from '../utils/emotionAnalyzer';

/** Owns service instances and subscriptions; StateManager remains the application state owner. */
export function useAssistantSession() {
  const capabilities = useSyncExternalStore(runtimeCapabilities.subscribe, runtimeCapabilities.getSnapshot);
  useEffect(() => { void runtimeCapabilities.load(); }, []);
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

  useEffect(() => {
    if (!capabilities.windowsControls) return;
    const client = new LocalActionClient();
    let disposed = false;
    const load = async () => {
      try {
        const [preferences, memories] = await Promise.all([
          client.request('/api/agent/state', { method: 'GET' }).then(response => response.json()),
          client.request('/api/agent/memories', { method: 'GET' }).then(response => response.json()),
        ]);
        if (!disposed) { stateManager.memoryEnabled = preferences.memoryEnabled === true; stateManager.setMemories(memories.memories || []); }
      } catch { if (!disposed) stateManager.memoryEnabled = false; }
    };
    stateManager.onMemoriesChanged = memories => {
      void client.request('/api/agent/memories', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memories }) }).then(response => { if (!response.ok) stateManager.setErrorMessage('The encrypted summary could not be saved.'); }).catch(() => stateManager.setErrorMessage('Local memory storage is unavailable.'));
    };
    void load(); window.addEventListener('sameera-preferences-changed', load);
    return () => { disposed = true; stateManager.onMemoriesChanged = null; window.removeEventListener('sameera-preferences-changed', load); };
  }, [capabilities.windowsControls, stateManager]);

  // Observable state
  const [appState, setAppState] = useState<AppState>(stateManager.getState());
  const [contextNotification, setContextNotification] = useState<string | null>(null);
  const [currentToolEvent, setCurrentToolEvent] = useState<ToolExecutionEvent | null>(null);
  const [mediaViewer, setMediaViewer] = useState<MediaViewerState | null>(null);
  const [articleReader, setArticleReader] = useState<ArticleReaderState | null>(null);
  const [articleSearch, setArticleSearch] = useState<ArticleSearchState | null>(null);

  // Live mic meter & spoken captions
  const [micAudioLevel, setMicAudioLevel] = useState<number>(0);
  const [liveCaption, setLiveCaption] = useState<{ role: 'user' | 'assistant'; text: string } | null>(null);
  const captionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contextTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showContextNotification = useCallback((message: string | null, duration = 4000) => {
    if (contextTimeoutRef.current) clearTimeout(contextTimeoutRef.current);
    setContextNotification(message);
    if (message) contextTimeoutRef.current = setTimeout(() => setContextNotification(null), duration);
  }, []);

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
      showContextNotification(
        stateManager.getLanguage() === 'telugu'
          ? 'సంభాషణ సందర్భం స్వయంచాలకంగా తాజాకరించబడింది'
          : 'Context smoothly compacted & re-anchored'
      );
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
      if (contextTimeoutRef.current) clearTimeout(contextTimeoutRef.current);
      liveSession.onStateChange = null;
      liveSession.onError = null;
      liveSession.onTranscription = null;
      liveSession.onContextRefreshed = null;
      liveSession.stop();
      player.destroy();
    };
  }, [liveSession, toolManager, stateManager, streamer, player, showContextNotification]);

  // Toggle session connection
  const handleToggleConnection = async () => {
    if (!capabilities.ready) {
      stateManager.setErrorMessage('Features are still loading. Please try again in a moment.');
      void runtimeCapabilities.load();
      return;
    }
    stateManager.setErrorMessage(null);

    if (appState.assistantState === 'disconnected') {
      try {
        // Unlock Web Audio immediately within the synchronous click gesture!
        await liveSession.unlockAudio();
        // Stored summaries stay local until a separate disclosure is approved.
        const memoryContext = ''; // Cloud sharing is controlled by the backend.
        await liveSession.start(memoryContext, appState.language);
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
    const nextMuted = !appState.isMuted;
    liveSession.setMuted(nextMuted);
    stateManager.setIsMuted(nextMuted);
  };

  return {
    capabilities, streamer, player, toolManager, stateManager, liveSession, appState,
    contextNotification, showContextNotification, currentToolEvent, setCurrentToolEvent,
    mediaViewer, setMediaViewer, articleReader, setArticleReader, articleSearch, setArticleSearch,
    micAudioLevel, liveCaption, handleToggleConnection, handleToggleMute,
  };
}
