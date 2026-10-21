import type { QuickNote, ToolExecutionEvent, VisualTheme, MediaViewerState, ArticleReaderState, ArticleSearchState } from '../../types/assistant';

export interface ToolCallPayload {
  id: string;
  name: string;
  args: Record<string, any>;
}

export interface ToolResponsePayload {
  id: string;
  name?: string;
  response: {
    output: Record<string, any>;
  };
}


export interface ToolCallbacks {
  onToolEvent?: (event: ToolExecutionEvent) => void;
  onThemeChange?: (theme: VisualTheme) => void;
  onNotesChange?: (notes: QuickNote[]) => void;
  onMediaOpen?: (media: MediaViewerState) => void;
  onArticleReader?: (reader: ArticleReaderState) => void;
  onArticleSearch?: (search: ArticleSearchState | null) => void;
}
export interface ToolEffects {
  recordEvent: (event: ToolExecutionEvent) => void;
  callbacks: () => ToolCallbacks;
  notify: (event: string) => void;
}
