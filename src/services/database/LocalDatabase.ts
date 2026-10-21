import { TaskRepository } from './TaskRepository.ts';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { DatabaseSync } from 'node:sqlite';
import { migrate, SCHEMA_VERSION } from './migrations.ts';
import { SettingsRepository } from './SettingsRepository.ts';
import { ConnectionRepository } from './ConnectionRepository.ts';

export function localDatabasePath(env = process.env): string {
  if (env.SAMEERA_DATABASE_PATH) {
    if (!path.isAbsolute(env.SAMEERA_DATABASE_PATH)) throw new Error('SAMEERA_DATABASE_PATH must be absolute');
    return env.SAMEERA_DATABASE_PATH;
  }
  return path.join(env.APPDATA || path.join(os.homedir(), '.sameera'), 'Sameera', 'data', 'sameera.sqlite');
}

export class LocalDatabase {
  readonly tasks: TaskRepository;
  readonly settings: SettingsRepository;
  readonly connections: ConnectionRepository;
  readonly schemaVersion = SCHEMA_VERSION;
  private closed = false;

  private constructor(private database: DatabaseSync, readonly filePath: string) {
    this.tasks = new TaskRepository(database);
    this.settings = new SettingsRepository(database);
    this.connections = new ConnectionRepository(database);
  }

  static async open(filePath: string): Promise<LocalDatabase> {
    if (!path.isAbsolute(filePath)) throw new Error('Local database path must be absolute');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    // Lazy loading keeps SQLite out of hosted web startup. The bundled Electron
    // runtime supplies SQLite; no native npm addon or separate install is needed.
    const { DatabaseSync } = await import('node:sqlite');
    const database = new DatabaseSync(filePath, { enableForeignKeyConstraints: true, allowExtension: false });
    try {
      database.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
      migrate(database);
      return new LocalDatabase(database, filePath);
    } catch (error) {
      database.close();
      throw error;
    }
  }

  close(): void {
    if (this.closed) return;
    this.database.close();
    this.closed = true;
  }
}

export async function openRuntimeDatabase(mode: string, filePath?: string): Promise<LocalDatabase | null> {
  if (mode === 'web') return null;
  if (!['desktop', 'local'].includes(mode)) throw new Error('Invalid database runtime mode');
  return LocalDatabase.open(filePath || localDatabasePath());
}
