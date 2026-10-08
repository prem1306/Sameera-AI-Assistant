export interface DialogueTurn {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

// Keep complete utterances, rather than treating every streaming fragment as a turn.
export class ConversationContext {
  private turns: DialogueTurn[] = [];
  append(role: DialogueTurn['role'], text: string): void {
    if (!text.trim()) return;
    const last = this.turns.at(-1);
    if (last?.role === role) {
      last.text = (last.text + text).slice(-24000);
      last.timestamp = Date.now();
    } else {
      this.turns.push({ role, text: text.slice(-24000), timestamp: Date.now() });
    }
    while (this.turns.length > 120 || this.turns.reduce((n, t) => n + t.text.length, 0) > 120000) {
      this.turns.shift();
    }
  }

  format(): string {
    // A bounded fallback for connections that cannot resume native model history.
    let remaining = 60000;
    const selected: string[] = [];
    for (const turn of [...this.turns].reverse()) {
      const line = `${turn.role === 'user' ? 'User' : 'Sameera'}: ${turn.text}`;
      if (line.length > remaining) break;
      selected.unshift(line);
      remaining -= line.length;
    }
    return selected.join('\n');
  }
}

export class ResponseWatchdog {
  private lastSpeech = 0;
  private waitingSince = 0;
  private flushed = false;
  private waiting = false;
  private speaking = false;

  speech(active: boolean, now: number): void {
    this.speaking = active;
    this.lastSpeech = now;
    if (active) this.flushed = false;
    else if (this.waiting) this.waitingSince = now;
  }
  input(now: number): void {
    this.waiting = true;
    this.lastSpeech = now;
    this.waitingSince = now;
    this.flushed = false;
  }
  progress(): void { this.waiting = false; this.flushed = false; }
  poll(now: number): 'flush' | 'recover' | null {
    if (!this.waiting || this.speaking || now - this.lastSpeech < 15000) return null;
    if (!this.flushed) { this.flushed = true; return 'flush'; }
    if (now - this.waitingSince >= 40000) { this.progress(); return 'recover'; }
    return null;
  }
}
