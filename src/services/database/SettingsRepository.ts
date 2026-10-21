import { languageValues, type Language } from '../session/Preferences.ts';
import type { DatabaseSync } from 'node:sqlite';

export type Preferences = {
  language: Language;
  persona: 'companion' | 'butler';
  privacyMode: 'controlled-cloud' | 'task-cloud' | 'local-only';
  memoryEnabled: boolean;
  providerPaid: boolean;
  theme: 'light' | 'dark' | 'system';
};

// Explicit preference keys prevent this repository becoming a secret store.
const values = { language: languageValues, theme: ['light', 'dark', 'system'], persona: ['companion', 'butler'], privacyMode: ['controlled-cloud', 'task-cloud', 'local-only'], memoryEnabled: [true, false], providerPaid: [true, false] };

export class SettingsRepository {
  constructor(private database: DatabaseSync) {}

  get<K extends keyof Preferences>(key: K): Preferences[K] | undefined {
    if (!Object.hasOwn(values, key)) throw new Error('Unsupported preference');
    const row = this.database.prepare('SELECT value_json FROM settings WHERE key = ?').get(key);
    if (!row) return undefined;
    const value = JSON.parse(String(row.value_json));
    if (!(values[key] as readonly unknown[]).includes(value)) throw new Error('Invalid stored preference');
    return value;
  }

  set<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
    if (!Object.hasOwn(values, key) || !(values[key] as readonly unknown[]).includes(value)) throw new Error('Unsupported preference');
    this.database.prepare(`INSERT INTO settings(key, value_json, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`)
      .run(key, JSON.stringify(value), new Date().toISOString());
  }
}
