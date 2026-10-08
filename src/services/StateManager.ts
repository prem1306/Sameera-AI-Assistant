/**
 * StateManager - Central observable store for Sameera assistant state,
 * theme management, active notes, audio reactive events,
 * and a persistent LocalStorage service for conversation memories and topic recall.
 */

import {
  AssistantState,
  EmotionalState,
  QuickNote,
  ToolExecutionEvent,
  VisualTheme,
  VisualizerMode,
  ConversationMemory,
  LanguageMode,
} from '../types/assistant';

export interface AppState {
  assistantState: AssistantState;
  emotionalState: EmotionalState;
  visualTheme: VisualTheme;
  visualizerMode: VisualizerMode;
  language: LanguageMode;
  isMuted: boolean;
  notes: QuickNote[];
  memories: ConversationMemory[];
  lastToolEvent: ToolExecutionEvent | null;
  history: ToolExecutionEvent[];
  errorMessage: string | null;
  sessionDuration: number;
}

type Listener = (state: AppState) => void;

const STORAGE_KEY_THEME = 'myraa_visual_theme';
const STORAGE_KEY_MODE = 'myraa_visualizer_mode';
const STORAGE_KEY_LANGUAGE = 'myraa_language_preference';
const STORAGE_KEY_MEMORIES = 'myraa_conversation_memories';
const MAX_STORED_MEMORIES = 25;

export class StateManager {
  private state: AppState = {
    assistantState: 'disconnected',
    emotionalState: 'neutral',
    visualTheme: 'midnight-violet',
    visualizerMode: 'orb',
    language: 'telugu',
    isMuted: false,
    notes: [],
    memories: [],
    lastToolEvent: null,
    history: [],
    errorMessage: null,
    sessionDuration: 0,
  };

  private listeners: Set<Listener> = new Set();
  private durationTimer: any = null;

  // Active session dialogue buffer for automatic summarization & memory generation
  private currentSessionTurns: { role: 'user' | 'assistant'; text: string; time: number }[] = [];

  constructor() {
    this.loadPersistedData();
  }

  /**
   * Load settings and memories from LocalStorage
   */
  private loadPersistedData(): void {
    try {
      const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) as VisualTheme;
      if (savedTheme) {
        this.state.visualTheme = savedTheme;
      }
      const savedMode = localStorage.getItem(STORAGE_KEY_MODE) as VisualizerMode;
      if (savedMode) {
        this.state.visualizerMode = savedMode;
      }

      const savedLang = localStorage.getItem(STORAGE_KEY_LANGUAGE) as LanguageMode;
      if (savedLang && ['english', 'telugu', 'bilingual'].includes(savedLang)) {
        this.state.language = savedLang;
      }

      const savedMemories = localStorage.getItem(STORAGE_KEY_MEMORIES);
      if (savedMemories) {
        const parsed = JSON.parse(savedMemories);
        if (Array.isArray(parsed)) {
          this.state.memories = parsed;
        }
      }
    } catch (e) {
      console.warn('[StateManager] Could not load persisted data:', e);
    }
  }

  getState(): AppState {
    return { ...this.state };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const currentState = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(currentState);
      } catch (err) {
        console.error('[StateManager] Listener error:', err);
      }
    });
  }

  setAssistantState(assistantState: AssistantState): void {
    if (this.state.assistantState === assistantState) return;

    const previousState = this.state.assistantState;
    this.state.assistantState = assistantState;

    if (assistantState === 'listening' || assistantState === 'speaking' || assistantState === 'thinking') {
      if (!this.durationTimer) {
        this.state.sessionDuration = 0;
        this.durationTimer = setInterval(() => {
          this.state.sessionDuration += 1;
          this.notify();
        }, 1000);
      }
    } else if (assistantState === 'disconnected') {
      if (this.durationTimer) {
        clearInterval(this.durationTimer);
        this.durationTimer = null;
      }
      // If previous call had active dialogue, auto-summarize and persist memory!
      if (previousState !== 'disconnected' && this.currentSessionTurns.length > 0) {
        this.finalizeCurrentSessionMemory();
      }
    }

    this.notify();
  }

  setVisualTheme(theme: VisualTheme): void {
    this.state.visualTheme = theme;
    try {
      localStorage.setItem(STORAGE_KEY_THEME, theme);
    } catch (e) {
      // ignore
    }
    this.notify();
  }

  setVisualizerMode(mode: VisualizerMode): void {
    this.state.visualizerMode = mode;
    try {
      localStorage.setItem(STORAGE_KEY_MODE, mode);
    } catch (e) {
      // ignore
    }
    this.notify();
  }

  setLanguage(language: LanguageMode): void {
    this.state.language = language;
    try {
      localStorage.setItem(STORAGE_KEY_LANGUAGE, language);
    } catch (e) {
      // ignore
    }
    this.notify();
  }

  getLanguage(): LanguageMode {
    return this.state.language;
  }

  setIsMuted(isMuted: boolean): void {
    this.state.isMuted = isMuted;
    this.notify();
  }

  setNotes(notes: QuickNote[]): void {
    this.state.notes = [...notes];
    this.notify();
  }

  setLastToolEvent(event: ToolExecutionEvent | null): void {
    this.state.lastToolEvent = event;
    if (event) {
      this.state.history = [event, ...this.state.history.slice(0, 19)];
    }
    this.notify();
  }

  setErrorMessage(errorMessage: string | null): void {
    this.state.errorMessage = errorMessage;
    this.notify();
  }

  setEmotionalState(emotionalState: EmotionalState): void {
    if (this.state.emotionalState === emotionalState) return;
    this.state.emotionalState = emotionalState;
    this.notify();
  }

  // ==========================================
  // CONVERSATION MEMORY LOCAL STORAGE SERVICE
  // ==========================================

  /**
   * Records a spoken turn into the active session buffer
   */
  recordDialogueTurn(role: 'user' | 'assistant', text: string): void {
    if (!text || text.trim().length === 0) return;
    const previous = this.currentSessionTurns.at(-1);
    if (previous?.role === role) {
      previous.text += text;
      previous.time = Date.now();
      return;
    }
    this.currentSessionTurns.push({
      role,
      text: text.trim(),
      time: Date.now(),
    });
  }

  /**
   * Finalizes the current session dialogue, extracts topics and key facts,
   * creates a persistent memory entry, and saves it into LocalStorage.
   */
  finalizeCurrentSessionMemory(): ConversationMemory | null {
    if (this.currentSessionTurns.length === 0) return null;

    const userTurns = this.currentSessionTurns.filter((t) => t.role === 'user');
    const assistantTurns = this.currentSessionTurns.filter((t) => t.role === 'assistant');

    if (userTurns.length === 0 && assistantTurns.length === 0) {
      this.currentSessionTurns = [];
      return null;
    }

    const allUserText = userTurns.map((t) => t.text).join(' ');
    const allText = this.currentSessionTurns.map((t) => `${t.role}: ${t.text}`).join('\n');

    // Extract discussed topics
    const topics: string[] = [];
    const lower = allText.toLowerCase();

    if (/project|code|coding|app|build|software|program|python|react|javascript|typescript|git/i.test(lower)) {
      topics.push('Coding & Projects');
    }
    if (/sport|sports|gym|workout|fitness|exercise|basketball|football|soccer|tennis|run|running/i.test(lower)) {
      topics.push('Sports & Fitness');
    }
    if (/music|song|listen|artist|band|playlist|guitar|beats/i.test(lower)) {
      topics.push('Music & Playlists');
    }
    if (/game|gaming|steam|playstation|xbox|nintendo|gamer/i.test(lower)) {
      topics.push('Gaming');
    }
    if (/work|office|job|meeting|deadline|career|client/i.test(lower)) {
      topics.push('Work & Career');
    }
    if (/study|college|school|exam|learn|university|class/i.test(lower)) {
      topics.push('Studies & Learning');
    }
    if (/food|cook|cooking|eat|dinner|lunch|breakfast|coffee/i.test(lower)) {
      topics.push('Food & Cooking');
    }
    if (/movie|film|watch|netflix|show|anime|series/i.test(lower)) {
      topics.push('Movies & Shows');
    }
    if (/travel|trip|flight|vacation|city|weekend/i.test(lower)) {
      topics.push('Travel & Weekend');
    }

    if (topics.length === 0) {
      topics.push('Casual Banter & Catchup');
    }

    // Extract key details mentioned by the user
    const keyDetails: string[] = [];
    userTurns.forEach((turn) => {
      const t = turn.text;
      if (/\b(i am|i'm|i work|i like|i love|my project|i build|i play|my name)\b/i.test(t)) {
        if (t.length <= 120) {
          keyDetails.push(t);
        } else {
          keyDetails.push(t.slice(0, 110) + '...');
        }
      }
    });

    // Generate concise summary snippet
    const userSnippets = userTurns
      .map((t) => t.text)
      .slice(0, 3)
      .join('; ');
    const summary = userSnippets
      ? `Talked about ${topics.join(', ')}. User mentioned: "${userSnippets.slice(0, 140)}${userSnippets.length > 140 ? '...' : ''}"`
      : `Casual chat covering ${topics.join(', ')}.`;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMemory: ConversationMemory = {
      id: Math.random().toString(36).slice(2, 9),
      timestamp: timeStr,
      dateStr,
      summary,
      topics,
      keyDetails: keyDetails.slice(0, 5),
      durationSeconds: this.state.sessionDuration,
    };

    // Prepend to persistent memories
    this.state.memories = [newMemory, ...this.state.memories.slice(0, MAX_STORED_MEMORIES - 1)];

    try {
      localStorage.setItem(STORAGE_KEY_MEMORIES, JSON.stringify(this.state.memories));
      console.log('[StateManager] Persisted conversation memory locally:', newMemory.summary);
    } catch (e) {
      console.warn('[StateManager] Failed saving memory to LocalStorage:', e);
    }

    // Clear buffer for next call
    this.currentSessionTurns = [];
    this.notify();

    return newMemory;
  }

  /**
   * Returns formatted conversational memory context to send to Gemini Live
   * so Sameera naturally recalls previous topics and user facts.
   */
  getFormattedMemoryContext(): string {
    if (this.state.memories.length === 0) {
      return '';
    }

    const recentMemories = this.state.memories.slice(0, 5);
    const bullets = recentMemories.map((m) => {
      const details = m.keyDetails.length > 0 ? ` (User shared: "${m.keyDetails.join('; ')}")` : '';
      return `- [${m.dateStr}]: Discussed ${m.topics.join(', ')}. Summary: ${m.summary}${details}`;
    });

    return `\n\nWHAT YOU REMEMBER FROM PREVIOUS CONVERSATIONS WITH THIS USER:\n${bullets.join('\n')}\nUse these memories naturally when appropriate to greet them, follow up on their projects, sports, or interests, and make your relationship feel personal and continuous.`;
  }

  /**
   * Delete an individual conversation memory
   */
  deleteMemory(id: string): void {
    this.state.memories = this.state.memories.filter((m) => m.id !== id);
    try {
      localStorage.setItem(STORAGE_KEY_MEMORIES, JSON.stringify(this.state.memories));
    } catch (e) {
      // ignore
    }
    this.notify();
  }

  /**
   * Clear all stored conversation memories
   */
  clearAllMemories(): void {
    this.state.memories = [];
    try {
      localStorage.removeItem(STORAGE_KEY_MEMORIES);
    } catch (e) {
      // ignore
    }
    this.notify();
  }
}
