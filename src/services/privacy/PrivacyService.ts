import { randomUUID } from 'node:crypto';
import type { PrivacyMode, Persona } from '../session/Preferences.ts';

export type Disclosure = { id: string; source: string; destination: 'Google Gemini'; preview: string; expires: number; state: 'pending' | 'approved' | 'cancelled' };
const secret = /-----BEGIN [^-]*PRIVATE KEY|\b(?:Bearer\s+[\w.-]{12,}|AIza[\w-]{25,}|hf_[A-Za-z0-9]{10,})|(?:password|api[_ -]?key|access[_ -]?token|cookie)["']?\s*[=:]\s*["']?\S+/i;
export function containsSecrets(value: unknown): boolean {
  if (typeof value === 'string') {
    let decoded = value; try { decoded = decodeURIComponent(value); } catch {}
    return secret.test(decoded) || /(?:^|[\\/])(?:\.env(?:\.[^\\/]*)?|\.ssh|\.aws|credentials|secrets)(?:$|[\\/])/i.test(decoded);
  }
  if (Array.isArray(value)) return value.some(containsSecrets);
  if (value && typeof value === 'object') return Object.entries(value).some(([key, value]) => /^(password|passwd|authorization|cookies?|api[_-]?key|access[_-]?token|refresh[_-]?token)$/i.test(key) && Boolean(value) || containsSecrets(value));
  return false;
}
/** All provider-bound tool data passes here. Unknown data is private. */
export class PrivacyService {
  mode: PrivacyMode = 'controlled-cloud';
  persona: Persona = 'companion';
  providerPaid = false;
  private resources = new Map<string, { disclosure: Disclosure; value: unknown }>();
  private listeners = new Set<() => void>();
  onChange(callback: () => void) { this.listeners.add(callback); return () => this.listeners.delete(callback); }
  configure(mode: PrivacyMode, persona: Persona, providerPaid: boolean) {
    if (!['controlled-cloud', 'task-cloud', 'local-only'].includes(mode) || !['companion', 'butler'].includes(persona) || typeof providerPaid !== 'boolean') throw new Error('Invalid privacy preferences.');
    this.mode = mode; this.persona = persona; this.providerPaid = providerPaid;
    this.resources.clear();
    for (const callback of this.listeners) callback();
  }
  state() { return { mode: this.mode, persona: this.persona, providerPaid: this.providerPaid, disclosures: [...this.resources.values()].map(row => row.disclosure).filter(row => row.expires > Date.now()) }; }
  protect(value: unknown, source: string): Record<string, unknown> {
    const preview = JSON.stringify(value ?? null);
    if (containsSecrets(value)) return { success: false, withheld: true, reason: 'Secret-like content blocked.' };
    for (const [id, row] of this.resources) if (row.disclosure.expires < Date.now()) this.resources.delete(id);
    if (preview.length > 64000 || this.resources.size >= 100) return { success: false, withheld: true, reason: 'Private result is too large; inspect it locally.' };
    const id = randomUUID();
    this.resources.set(id, { value: structuredClone(value ?? null), disclosure: { id, source, destination: 'Google Gemini', preview, expires: Date.now() + 120000, state: 'pending' } });
    // Never echo strings from the result, paths, URLs or filenames into this summary.
    return { resourceId: id, withheld: true, success: (value as any)?.success === true, requiresUserApproval: true, instruction: 'Result is available locally. Ask the user to inspect it in Agent activity. Private contents have not been shared with you.' };
  }
  approve(id: string) {
    const row = this.resources.get(id);
    if (!row || row.disclosure.expires < Date.now() || row.disclosure.state !== 'pending') throw new Error('Disclosure expired or already decided.');
    if (this.mode === 'local-only' || !this.providerPaid) throw new Error('Cloud sharing needs cloud mode and confirmed paid-service data handling.');
    row.disclosure.state = 'approved';
  }
  consume(id: string): unknown {
    const row = this.resources.get(id);
    if (this.mode === 'local-only' || !this.providerPaid || !row || row.disclosure.state !== 'approved' || row.disclosure.expires < Date.now()) throw new Error('No current disclosure approval.');
    this.resources.delete(id); return row.value;
  }
  cancel(id: string) { this.resources.delete(id); }
}
