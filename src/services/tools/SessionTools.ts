import type { QuickNote, ToolExecutionEvent, VisualTheme } from '../../types/assistant';
import type { ToolCallPayload, ToolEffects } from './types.ts';

export class SessionTools {
  private notes: QuickNote[] = [];
  constructor(private readonly effects: ToolEffects) {
    // Load existing notes from local storage if available
    try {
      const saved = localStorage.getItem('myraa_session_notes');
      if (saved) {
        this.notes = JSON.parse(saved);
      }
    } catch (e) {
      // ignore
    }
  }


  async execute(call: ToolCallPayload): Promise<Record<string, any>> {
    switch (call.name) {
      case 'getDateTime': {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        const timeStr = now.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const event: ToolExecutionEvent = {
          id: Math.random().toString(36).slice(2, 9),
          name: 'getDateTime',
          title: 'Clock & Calendar',
          description: `${timeStr}, ${dateStr} (${timeZone})`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'success',
        };
        this.effects.recordEvent(event);

        return {
          currentDate: dateStr,
          currentTime: timeStr,
          timeZone,
          isoTimestamp: now.toISOString(),
        };
      }

      case 'controlVisualTheme': {
        const theme = String(call.args.theme || '').toLowerCase() as VisualTheme;
        const validThemes: VisualTheme[] = [
          'cyberpunk',
          'midnight-violet',
          'aurora-emerald',
          'crimson-neon',
          'solar-gold',
        ];

        const selectedTheme = validThemes.includes(theme) ? theme : 'midnight-violet';
        this.effects.callbacks().onThemeChange?.(selectedTheme);

        const event: ToolExecutionEvent = {
          id: Math.random().toString(36).slice(2, 9),
          name: 'controlVisualTheme',
          title: 'Theme Transformation',
          description: `Shifted ambiance to ${selectedTheme.replace('-', ' ').toUpperCase()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'success',
        };
        this.effects.recordEvent(event);

        return {
          success: true,
          theme: selectedTheme,
          message: `Interface styling dynamically shifted to ${selectedTheme}`,
        };
      }

      case 'takeQuickNote': {
        const noteText = String(call.args.note || '').trim();
        const newNote: QuickNote = {
          id: Math.random().toString(36).slice(2, 9),
          text: noteText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        this.notes.unshift(newNote);
        try {
          localStorage.setItem('myraa_session_notes', JSON.stringify(this.notes));
        } catch (e) {
          // ignore
        }
        this.effects.callbacks().onNotesChange?.([...this.notes]);

        const event: ToolExecutionEvent = {
          id: newNote.id,
          name: 'takeQuickNote',
          title: 'Note Recorded',
          description: noteText,
          timestamp: newNote.timestamp,
          status: 'success',
        };
        this.effects.recordEvent(event);

        return {
          success: true,
          savedNote: noteText,
          totalNotes: this.notes.length,
          message: `Saved note: "${noteText}"`,
        };
      }

      default: return { error: `Unknown function ${call.name}` };
    }
  }
  getNotes(): QuickNote[] {
    return [...this.notes];
  }

  deleteNote(id: string): void {
    this.notes = this.notes.filter((n) => n.id !== id);
    try {
      localStorage.setItem('myraa_session_notes', JSON.stringify(this.notes));
    } catch (e) {
      // ignore
    }
    this.effects.callbacks().onNotesChange?.([...this.notes]);
  }

  clearNotes(): void {
    this.notes = [];
    try {
      localStorage.removeItem('myraa_session_notes');
    } catch (e) {
      // ignore
    }
    this.effects.callbacks().onNotesChange?.([]);
  }

}
