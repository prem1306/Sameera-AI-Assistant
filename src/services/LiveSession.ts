import { LocalActionClient } from './tools/LocalActionClient';
import { runtimeCapabilities } from './RuntimeCapabilities';
/**
 * LiveSession - Coordinates the full voice-to-voice bidirectional loop:
 * WebSocket connection, AudioStreamer (mic input), AudioPlayer (Gemini output),
 * ToolManager, live subtitles, and assistant state machine.
 * Features persistent continuous session management and auto-reconnection so the call
 * NEVER drops after a conversation turn until the user explicitly ends it.
 */

import { AssistantState, LanguageMode } from '../types/assistant';
import { AudioPlayer } from './AudioPlayer';
import { AudioStreamer } from './AudioStreamer';
import { ToolManager } from './ToolManager';

export class LiveSession {
  private ws: WebSocket | null = null;
  private audioStreamer: AudioStreamer;
  private audioPlayer: AudioPlayer;
  private toolManager: ToolManager;

  private state: AssistantState = 'disconnected';
  private pingInterval: any = null;
  private reconnectTimeout: any = null;
  private thinkingTimeout: any = null;
  private isIntentionalClose = false;
  private isServerReady = false;
  private reconnectAttempts = 0;
  private memoryContext = '';
  private language: LanguageMode = 'telugu';

  public onStateChange: ((state: AssistantState) => void) | null = null;
  public onError: ((errorMsg: string) => void) | null = null;
  public onTranscription: ((data: { role: 'user' | 'assistant'; text: string }) => void) | null = null;
  public onContextRefreshed: (() => void) | null = null;

  constructor(
    audioStreamer: AudioStreamer,
    audioPlayer: AudioPlayer,
    toolManager: ToolManager
  ) {
    this.audioStreamer = audioStreamer;
    this.audioPlayer = audioPlayer;
    this.toolManager = toolManager;

    // Connect audio player speaking change to assistant state and acoustic ducking
    this.audioPlayer.onSpeakingChange = (speaking) => {
      this.audioStreamer.setAssistantSpeaking(speaking);
      if (this.state === 'disconnected' || this.state === 'connecting') return;
      // Seamlessly transition between speaking and listening, keeping call active!
      this.setState(speaking ? 'speaking' : 'listening');
    };

    // When user actively starts speaking, exit thinking state immediately
    this.audioStreamer.onSpeechStartCallback = () => {
      this.sendSpeechActivity(true);
      if (this.state === 'thinking') {
        this.setState('listening');
      }
    };

    // Speech end callback: maintain listening state so room chatter doesn't lock UI in thinking
    this.audioStreamer.onSpeechEndCallback = () => {
      this.sendSpeechActivity(false);
    };
  }

  private sendSpeechActivity(active: boolean): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'speechActivity', active }));
    }
  }

  private setState(newState: AssistantState): void {
    if (this.thinkingTimeout) {
      clearTimeout(this.thinkingTimeout);
      this.thinkingTimeout = null;
    }

    if (this.state === newState) return;
    this.state = newState;
    this.onStateChange?.(newState);

    // Watchdog timer: Automatically return to listening after 3.5s so UI is NEVER stuck thinking
    if (newState === 'thinking') {
      this.thinkingTimeout = setTimeout(() => {
        if (this.state === 'thinking') {
          console.log('[LiveSession] Thinking watchdog timeout; resetting to listening');
          this.setState('listening');
        }
      }, 3500);
    }
  }

  getState(): AssistantState {
    return this.state;
  }

  notifyArticleOpened(article: Record<string, any>): void {
    if (this.isServerReady && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'articleOpened', article }));
    }
  }

  notifyAgent(id: string, disclosure = false): void {
    if (this.isServerReady && this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: disclosure ? 'disclosureApproved' : 'agentStatus', id }));
  }

  notifyGmailUpdated(): void {
    if (this.isServerReady && this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'gmailUpdated' }));
  }
  notifyMcpResult(id: string): void {
    if (this.isServerReady && this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'mcpResult', id }));
  }

  /**
   * Unlock Web Audio engines synchronously on user gesture before connecting
   */
  async unlockAudio(): Promise<void> {
    await Promise.all([
      this.audioPlayer.unlock(),
      this.audioStreamer.unlock(),
    ]);
  }

  setLanguage(lang: LanguageMode): void {
    this.language = lang;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'setLanguage',
        language: lang,
      }));
    }
  }

  /**
   * Start a new live voice session with optional past conversational memory context and language
   */
  async start(memoryContext?: string, language?: LanguageMode): Promise<void> {
    if (this.state !== 'disconnected') return;

    this.isIntentionalClose = false;
    this.reconnectAttempts = 0;
    this.memoryContext = ''; // Sharing memories needs a separate backend disclosure grant.
    if (language) this.language = language;
    this.setState('connecting');

    try {
      // 1. Unlock audio first
      await this.unlockAudio();

      // 2. Establish continuous microphone stream
      await this.audioStreamer.start((base64PCM) => {
        if (this.isServerReady && this.ws && this.ws.readyState === WebSocket.OPEN) {
          // Guard against socket buffer buildup in long sessions
          if (this.ws.bufferedAmount < 65536) {
            this.ws.send(JSON.stringify({
              type: 'audio',
              data: base64PCM,
            }));
          }
        }
      });

      // 3. Connect WebSocket to /live
      this.connectWebSocket();
    } catch (err: any) {
      console.error('[LiveSession] Start error:', err);
      this.onError?.(err?.message || 'Could not start voice session. Check microphone permissions.');
      this.stop();
    }
  }

  private async connectWebSocket(): Promise<void> {
    if (this.isIntentionalClose) return;
    this.isServerReady = false;
    this.setState('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const params = new URLSearchParams();

    if (this.language) params.set('lang', this.language);
    const query = params.toString() ? `?${params.toString()}` : '';
    let wsUrl = `${protocol}//${window.location.host}/live${query}`;
    console.log('[LiveSession] Connecting voice session');

    try {
      const response = runtimeCapabilities.getSnapshot().windowsControls
        ? await new LocalActionClient().request('/api/voice/session', { method: 'POST' })
        : await fetch('/api/voice/session', { method: 'POST' });
      if (!response.ok) throw new Error('Voice session authorization failed.');
      const { ticket } = await response.json();
      params.set('ticket', ticket);
      wsUrl = `${protocol}//${window.location.host}/live?${params}`;
      if (this.isIntentionalClose) return;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[LiveSession] WebSocket connection established. Continuous listening active.');
        this.reconnectAttempts = 0;
        // Keep connecting until Gemini setup succeeds, rather than losing early commands.

        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 15000);
      };

      this.ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case 'connected':
              console.log('[LiveSession] Assistant ready:', msg.assistantName, msg.voice);
              this.isServerReady = true;
              this.setState('listening');
              break;

            case 'localProgress':
              window.dispatchEvent(new CustomEvent('sameera-local-progress', { detail: String(msg.stage || '') }));
              break;
            case 'audio':
              if (msg.data) {
                if (this.state === 'thinking') {
                  this.setState('speaking');
                }
                this.audioPlayer.queueAudioChunk(msg.data);
              }
              break;

            case 'transcription':
              if (msg.text) {
                if (msg.role === 'assistant' && this.state === 'thinking') {
                  this.setState('speaking');
                }
                this.onTranscription?.({
                  role: msg.role || 'assistant',
                  text: msg.text,
                });
              }
              break;

            case 'interrupted':
              console.log('[LiveSession] User interrupted Sameera');
              this.audioPlayer.interrupt();
              this.setState('listening');
              break;

            case 'turnComplete':
              window.dispatchEvent(new CustomEvent('sameera-local-progress', { detail: '' }));
              // Conversation turn completed - if not speaking, return to listening
              if (!this.audioPlayer.getIsSpeaking() && this.state !== 'disconnected') {
                this.setState('listening');
              }
              break;

            case 'thinking':
              if (this.state !== 'speaking' && this.state !== 'disconnected') {
                this.setState('thinking');
              }
              break;

            case 'agentUpdate':
              window.dispatchEvent(new Event('sameera-agent-update'));
              break;
            case 'mcpToolResult':
              window.dispatchEvent(new Event(msg.requiresUserApproval ? 'sameera-mcp-review' : 'sameera-mcp-update'));
              break;

            case 'toolCall':
              this.setState('thinking');
              if (msg.functionCalls && Array.isArray(msg.functionCalls)) {
                console.log('[LiveSession] Tool requests received');
                const responses = await this.toolManager.executeToolCalls(msg.functionCalls);
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                  this.ws.send(JSON.stringify({
                    type: 'toolResponse',
                    functionResponses: responses,
                  }));
                }
              }
              break;

            case 'toolCallCancellation':
              this.toolManager.cancelToolCalls(msg.ids || []);
              if (!this.audioPlayer.getIsSpeaking()) this.setState('listening');
              break;

            case 'warning':
              console.warn('[LiveSession] Server warning');
              this.onError?.(msg.message || 'Voice connection issue');
              break;

            case 'error':
              console.error('[LiveSession] Server error message');
              this.onError?.(msg.message || 'Voice connection issue');
              break;

            case 'sessionClosed':
              console.log('[LiveSession] Server reported underlying session renewal; maintaining connection.');
              // Do NOT stop; server automatically re-establishes session!
              break;

            case 'contextRefreshed':
              console.log('[LiveSession] Server compacted and refreshed session context seamlessly');
              this.onContextRefreshed?.();
              this.setState('listening');
              break;

            case 'pong':
              break;
          }
        } catch (err: any) {
          console.error('[LiveSession] Message processing error:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.error('[LiveSession] WebSocket error:', err);
      };

      this.ws.onclose = (event) => {
        this.isServerReady = false;
        console.log('[LiveSession] WebSocket closed:', event.code);
        // Only stop if user intentionally clicked "End Call"
        if (event.code === 1000 || event.code === 1008) { this.stop(); return; }
        if (!this.isIntentionalClose) {
          this.reconnect();
        }
      };
    } catch (err: any) {
      console.error('[LiveSession] Failed creating WebSocket:', err);
      if (!this.isIntentionalClose) {
        this.reconnect();
      }
    }
  }

  private reconnect(): void {
    if (this.isIntentionalClose) return;

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts - 1), 5000);
    console.log(`[LiveSession] Reconnecting in ${delay}ms (attempt #${this.reconnectAttempts})...`);

    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      if (!this.isIntentionalClose) {
        this.connectWebSocket();
      }
    }, delay);
  }

  /**
   * Stop the active live voice session (Only called when user clicks End Call)
   */
  stop(): void {
    this.isIntentionalClose = true;
    this.isServerReady = false;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Stop audio player & cancel queue
    this.audioPlayer.interrupt();

    // Stop mic stream
    this.audioStreamer.stop();

    // Close WebSocket
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }

    this.setState('disconnected');
    console.log('[LiveSession] Session ended by user.');
  }

  setMuted(muted: boolean): void {
    this.audioStreamer.setMuted(muted);
  }

  isMuted(): boolean {
    return this.audioStreamer.getIsMuted();
  }

  /**
   * Request server-side context compaction & clean session re-anchoring
   */
  refreshContext(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[LiveSession] Sending refreshContext request to server...');
      this.ws.send(JSON.stringify({ type: 'refreshContext' }));
    }
  }
}
