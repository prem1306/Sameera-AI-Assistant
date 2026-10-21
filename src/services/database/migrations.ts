import type { DatabaseSync } from 'node:sqlite';

const migrations = [{ version: 1, sql: `
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL CHECK(json_valid(value_json)),
    updated_at TEXT NOT NULL
  ) STRICT;
  CREATE TABLE connections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    transport TEXT NOT NULL CHECK(transport IN ('http', 'stdio')),
    enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0, 1)),
    credential_ref TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;
  CREATE TABLE tool_permissions (
    connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
    tool_name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0, 1)),
    require_confirmation INTEGER NOT NULL DEFAULT 1 CHECK(require_confirmation IN (0, 1)),
    PRIMARY KEY(connection_id, tool_name)
  ) STRICT;
  CREATE TABLE plugin_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    manifest_version INTEGER NOT NULL CHECK(manifest_version > 0),
    installed_at TEXT NOT NULL
  ) STRICT;
  CREATE TABLE tool_events (
    id INTEGER PRIMARY KEY,
    connection_id TEXT,
    tool_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'cancelled', 'unknown')),
    duration_ms INTEGER NOT NULL CHECK(duration_ms >= 0),
    created_at TEXT NOT NULL
  ) STRICT;
  CREATE INDEX tool_events_created_at ON tool_events(created_at);
` }, { version: 2, sql: `
  ALTER TABLE connections ADD COLUMN config_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(config_json));
  ALTER TABLE plugin_presets ADD COLUMN manifest_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(manifest_json));
` }, { version: 3, sql: `
  CREATE TABLE agent_tasks (id TEXT PRIMARY KEY, state TEXT NOT NULL CHECK(state IN ('planning','running','waiting-approval','completed','failed','cancelled','uncertain')), updated_at TEXT NOT NULL) STRICT;
` }];

export const SCHEMA_VERSION = migrations.at(-1)!.version;

export function migrate(database: DatabaseSync): void {
  // One transaction includes the version check, so concurrent startup cannot
  // apply the same migration twice. A failed upgrade leaves the old schema intact.
  database.exec('BEGIN IMMEDIATE');
  try {
    database.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL) STRICT');
    const rows = database.prepare('SELECT version FROM schema_migrations ORDER BY version').all();
    const versions = rows.map(row => Number(row.version));
    if (versions.some((version, index) => version !== index + 1) || versions.length > SCHEMA_VERSION) {
      throw new Error('Unsupported local database version. Use a compatible Sameera app; the database was not reset.');
    }
    for (const migration of migrations.slice(versions.length)) {
      database.exec(migration.sql);
      database.prepare('INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)').run(migration.version, new Date().toISOString());
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
