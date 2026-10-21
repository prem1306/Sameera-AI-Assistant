/**
 * ToolManager - Executes client-side browser actions requested by Gemini Live
 * and returns structured responses immediately.
 */

import { QuickNote, ToolExecutionEvent, VisualTheme, MediaViewerState, ArticleReaderState, ArticleSearchState } from '../types/assistant';
import { ArticleTools } from './tools/ArticleTools.ts';
import { BrowserTools } from './tools/BrowserTools.ts';
import { ResearchTools } from './tools/ResearchTools.ts';
import { SessionTools } from './tools/SessionTools.ts';
import { GmailTools } from './tools/GmailTools.ts';
import { McpTools } from './tools/McpTools.ts';
import { SystemTools } from './tools/SystemTools.ts';
import { LocalActionClient } from './tools/LocalActionClient.ts';
import type { ToolCallPayload, ToolResponsePayload, ToolEffects } from './tools/types.ts';
export type { ToolCallPayload, ToolResponsePayload } from './tools/types.ts';
import { runtimeCapabilities } from './RuntimeCapabilities';
import { DESKTOP_TOOLS } from './RuntimePolicy';

export class ToolManager {
  private onArticleSearchCallback: ((search: ArticleSearchState | null) => void) | null = null;
  private cancelledCalls = new Set<string>();
  private callResults = new Map<string, Promise<Record<string, any>>>();
  private executionHistory: ToolExecutionEvent[] = [];
  private onToolEventCallback: ((event: ToolExecutionEvent) => void) | null = null;
  private onThemeChangeCallback: ((theme: VisualTheme) => void) | null = null;
  private onNotesChangeCallback: ((notes: QuickNote[]) => void) | null = null;
  private onMediaOpenCallback: ((media: MediaViewerState) => void) | null = null;
  private onArticleReaderCallback: ((reader: ArticleReaderState) => void) | null = null;

  private readonly effects: ToolEffects = {
    recordEvent: event => this.recordEvent(event),
    notify: name => window.dispatchEvent(new Event(name)),
    callbacks: () => ({ onArticleSearch: this.onArticleSearchCallback || undefined, onArticleReader: this.onArticleReaderCallback || undefined, onMediaOpen: this.onMediaOpenCallback || undefined, onNotesChange: this.onNotesChangeCallback || undefined, onThemeChange: this.onThemeChangeCallback || undefined }),
  };
  private readonly localClient = new LocalActionClient();
  private readonly articles = new ArticleTools(this.effects);
  private readonly browser = new BrowserTools(this.effects);
  private readonly research = new ResearchTools();
  private readonly session = new SessionTools(this.effects);
  private readonly gmail = new GmailTools(this.localClient, this.effects);
  private readonly mcp = new McpTools(this.localClient, this.effects);
  private readonly system = new SystemTools(this.localClient, this.effects);

  setCallbacks(callbacks: {
    onToolEvent?: (event: ToolExecutionEvent) => void;
    onThemeChange?: (theme: VisualTheme) => void;
    onNotesChange?: (notes: QuickNote[]) => void;
    onMediaOpen?: (media: MediaViewerState) => void;
    onArticleReader?: (reader: ArticleReaderState) => void;
    onArticleSearch?: (search: ArticleSearchState | null) => void;
  }): void {
    if (callbacks.onToolEvent) this.onToolEventCallback = callbacks.onToolEvent;
    if (callbacks.onThemeChange) this.onThemeChangeCallback = callbacks.onThemeChange;
    if (callbacks.onNotesChange) this.onNotesChangeCallback = callbacks.onNotesChange;
    if (callbacks.onMediaOpen) this.onMediaOpenCallback = callbacks.onMediaOpen;
    if (callbacks.onArticleReader) this.onArticleReaderCallback = callbacks.onArticleReader;
    if (callbacks.onArticleSearch) this.onArticleSearchCallback = callbacks.onArticleSearch;
  }

  /**
   * Executes a batch of function calls from Gemini Live
   */
  async executeToolCalls(calls: ToolCallPayload[]): Promise<ToolResponsePayload[]> {
    const responses: ToolResponsePayload[] = [];

    for (const call of calls) {
      if (this.cancelledCalls.delete(call.id)) continue;
      let execution = this.callResults.get(call.id);
      if (!execution) {
        execution = this.executeSingleCall(call).catch((error) => ({
          success: false,
          error: error instanceof Error ? error.message : 'Tool execution failed',
          ...(['performSystemAction', 'draftGmailMail', 'requestGmailSend'].includes(call.name) ? { needsClarification: true, question: 'The action did not return a verified result. Please inspect the application before retrying. How should I proceed?' } : {}),
        }));
        this.callResults.set(call.id, execution);
        if (this.callResults.size > 100) this.callResults.delete(this.callResults.keys().next().value!);
      }
      const result = await execution;
      if (this.cancelledCalls.delete(call.id)) continue;
      responses.push({
        id: call.id,
        name: call.name,
        response: {
          output: result,
        },
      });
      if (result.needsClarification || result.requiresInspection) {
        for (const remaining of calls.slice(calls.indexOf(call) + 1)) responses.push({ id: remaining.id, name: remaining.name, response: { output: { success: false, notExecuted: true, message: 'A previous step needs clarification or inspection. Wait before executing dependent actions.' } } });
        break;
      }
    }

    return responses;
  }

  cancelToolCalls(ids: string[]): void {
    for (const id of ids) this.cancelledCalls.add(id);
  }

  focusArticle(paragraph: number, selectedText = ''): void { this.articles.focus(paragraph, selectedText); }
  closeArticle(): void { this.articles.close(); }
  dismissArticleSearch(): void { this.articles.dismissSearch(); }
  async selectArticle(articleId: string): Promise<Record<string, any>> {
    return this.executeSingleCall({ id: crypto.randomUUID(), name: 'chooseArticle', args: { articleId } });
  }

  private async executeSingleCall(call: ToolCallPayload): Promise<Record<string, any>> {
    console.log(`[ToolManager] Executing ${call.name}`);
    if (DESKTOP_TOOLS.has(call.name) && !runtimeCapabilities.getSnapshot().windowsControls) return { success: false, message: 'This feature is available in Sameera for Windows. The website supports conversation and browsing.' };
    if (this.articles.navigationBlocked(call.name)) {
      return { success: false, message: 'Article sources are already displayed. Ask which source the user wants and wait, or use chooseArticle after their explicit selection/delegation. No tabs were opened.' };
    }

    switch (call.name) {
      case 'searchWebSources':
      case 'readWebpage': return this.research.execute(call);
      case 'listConnectedTools':
      case 'callConnectedTool': return this.mcp.execute(call);
      case 'getGmailDraft':
      case 'draftGmailMail':
      case 'requestGmailSend': return this.gmail.execute(call);
      case 'performSystemAction': return this.system.execute(call);
      case 'searchArticles':
      case 'chooseArticle':
      case 'getCurrentArticle':
      case 'readArticleOrWebpage': return this.articles.execute(call);
      case 'findYouTubeVideos':
      case 'openWebsite':
      case 'openYouTube':
      case 'searchWeb': return this.browser.execute(call);
      case 'getDateTime':
      case 'controlVisualTheme':
      case 'takeQuickNote': return this.session.execute(call);

      default: {
        console.warn(`[ToolManager] Unknown tool called: ${call.name}`);
        return {
          error: `Unknown function ${call.name}`,
        };
      }
    }
  }

  private recordEvent(event: ToolExecutionEvent): void {
    this.executionHistory.unshift(event);
    if (this.executionHistory.length > 20) {
      this.executionHistory.pop();
    }
    this.onToolEventCallback?.(event);
  }

  getNotes(): QuickNote[] { return this.session.getNotes(); }
  deleteNote(id: string): void { this.session.deleteNote(id); }
  clearNotes(): void { this.session.clearNotes(); }

  getExecutionHistory(): ToolExecutionEvent[] {
    return [...this.executionHistory];
  }
}
