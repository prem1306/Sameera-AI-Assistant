import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { validateConfig, connectionName } from '../mcp/ConnectionConfig.ts';
import type { Connection, ConnectionConfig } from '../mcp/types.ts';

export class ConnectionRepository {
  constructor(private database: DatabaseSync) {}
  list(): Connection[] {
    return this.database.prepare('SELECT * FROM connections ORDER BY created_at').all().map(row => ({
      id: String(row.id), name: String(row.name), enabled: row.enabled === 1, hasCredential: Boolean(row.credential_ref), config: JSON.parse(String(row.config_json)),
    }));
  }
  get(id: string): Connection {
    const result = this.list().find(row => row.id === id);
    if (!result) throw new Error('Connection not found.');
    return result;
  }
  add(name: string, config: ConnectionConfig): Connection {
    const id = randomUUID(), now = new Date().toISOString();
    this.database.prepare('INSERT INTO connections(id,name,transport,created_at,updated_at,config_json) VALUES(?,?,?,?,?,?)')
      .run(id, connectionName(name), config.transport, now, now, JSON.stringify(validateConfig(config)));
    return this.get(id);
  }
  setEnabled(id: string, enabled: boolean): void { this.get(id); this.database.prepare('UPDATE connections SET enabled=?,updated_at=? WHERE id=?').run(Number(enabled), new Date().toISOString(), id); }
  setCredential(id: string, present: boolean): void { this.get(id); this.database.prepare('UPDATE connections SET credential_ref=? WHERE id=?').run(present ? id : null, id); }
  remove(id: string): void { this.get(id); this.database.prepare('DELETE FROM connections WHERE id=?').run(id); }
  permissions(id: string): Map<string, boolean> {
    return new Map(this.database.prepare('SELECT tool_name,enabled FROM tool_permissions WHERE connection_id=?').all(id).map(row => [String(row.tool_name), row.enabled === 1]));
  }
  setPermission(id: string, tool: string, enabled: boolean): void {
    this.get(id);
    this.database.prepare('INSERT INTO tool_permissions(connection_id,tool_name,enabled) VALUES(?,?,?) ON CONFLICT(connection_id,tool_name) DO UPDATE SET enabled=excluded.enabled').run(id, tool, Number(enabled));
  }
  record(id: string, tool: string, status: 'success' | 'failed' | 'unknown', milliseconds: number): void {
    this.database.prepare('INSERT INTO tool_events(connection_id,tool_name,status,duration_ms,created_at) VALUES(?,?,?,?,?)').run(id, tool, status, milliseconds, new Date().toISOString());
    this.database.exec('DELETE FROM tool_events WHERE id NOT IN (SELECT id FROM tool_events ORDER BY id DESC LIMIT 500)');
  }
  history() { return this.database.prepare('SELECT id,connection_id,tool_name,status,duration_ms,created_at FROM tool_events ORDER BY id DESC LIMIT 30').all(); }
  presets() { return this.database.prepare('SELECT id,name,manifest_json FROM plugin_presets ORDER BY installed_at').all().map(row => ({ id: String(row.id), name: String(row.name), manifest: JSON.parse(String(row.manifest_json)) })); }
  savePreset(id: string, name: string, manifest: unknown): void {
    this.database.prepare('INSERT INTO plugin_presets(id,name,manifest_version,installed_at,manifest_json) VALUES(?,?,1,?,?)').run(id, name, new Date().toISOString(), JSON.stringify(manifest));
  }
  removePreset(id: string): void { this.database.prepare('DELETE FROM plugin_presets WHERE id=?').run(id); }
}
