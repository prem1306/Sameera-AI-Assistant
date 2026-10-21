/**
 * Types for Sameera AI Assistant
 */

export type AssistantState = 'disconnected' | 'connecting' | 'listening' | 'thinking' | 'speaking';

export type EmotionalState = 'neutral' | 'playful' | 'curious' | 'empathetic' | 'excited';

export type LanguageMode = import('../services/session/Preferences').Language;

export type VisualizerMode = 'orb' | 'waveform' | 'nebula' | 'frequency-ring';

export type VisualTheme = 
  | 'cyberpunk' 
  | 'midnight-violet' 
  | 'aurora-emerald' 
  | 'crimson-neon' 
  | 'solar-gold';

export interface QuickNote {
  id: string;
  text: string;
  timestamp: string;
}

export interface ConversationMemory {
  id: string;
  timestamp: string;
  dateStr: string;
  summary: string;
  topics: string[];
  keyDetails: string[];
  durationSeconds: number;
}

export interface MediaViewerState {
  isOpen: boolean;
  type: 'youtube' | 'website';
  title: string;
  url: string;
  embedUrl: string;
}

export interface ArticleReaderState {
  isOpen: boolean;
  title: string;
  content: string;
  paragraphs: string[];
  url: string;
  isReadingAloud: boolean;
  wordCount: number;
}

export interface ArticleSuggestion {
  id: string;
  title: string;
  url: string;
  website: string;
}

export interface ArticleSearchState {
  topic: string;
  articles: ArticleSuggestion[];
  searchSuggestionsHtml?: string;
  provider?: string;
}

export interface ToolExecutionEvent {
  id: string;
  name: string;
  title: string;
  description: string;
  timestamp: string;
  url?: string;
  status: 'running' | 'success' | 'failed';
}

export interface AssistantConfig {
  voice: string;
  theme: VisualTheme;
  visualizerMode: VisualizerMode;
  echoCancellation: boolean;
  noiseSuppression: boolean;
}

export interface AudioChunkMetric {
  sequenceNumber: number;
  timestamp: number;
  sampleCount: number;
  durationMs: number;
  inputSampleRate: number;
  targetSampleRate: number;
  peakAmplitude: number;
  rms: number;
  isSilence: boolean;
  isClipping: boolean;
  base64Length: number;
  validPcm: boolean;
}

export interface AudioDiagnosticSummary {
  isStreaming: boolean;
  isMuted: boolean;
  hardwareSampleRate: number;
  targetSampleRate: number;
  totalChunks: number;
  totalSamples: number;
  totalDurationSeconds: number;
  speechChunksCount: number;
  silenceChunksCount: number;
  clippingCount: number;
  averageRms: number;
  peakAmplitudeEver: number;
  recentChunks: AudioChunkMetric[];
  lastChunkTimestamp: number | null;
}
