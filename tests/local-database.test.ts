import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { LocalDatabase, localDatabasePath, openRuntimeDatabase } from '../src/services/database/LocalDatabase.ts';
import { SCHEMA_VERSION } from '../src/services/database/migrations.ts';

async function fixture(run: (folder: string) => Promise<void>) {
  const root = process.cwd();
  const folder = await fs.mkdtemp(path.join(root, '.system-actions-test-'));
  try { await run(folder); }
  finally {
    assert.equal(path.dirname(folder), root);
    await fs.rm(folder, { recursive: true });
  }
}

test('SQLite creates schema and preferences survive reopen without rerunning migrations', async () => {
  await fixture(async folder => {
    const file = path.join(folder, 'profile', 'sameera.sqlite');
    const first = await LocalDatabase.open(file);
    assert.equal(first.schemaVersion, SCHEMA_VERSION);
    first.settings.set('language', 'english');
    first.settings.set('theme', 'dark');
    first.close(); first.close();
    const second = await LocalDatabase.open(file);
    assert.equal(second.settings.get('language'), 'english');
    assert.equal(second.settings.get('theme'), 'dark');
    assert.throws(() => second.settings.set('apiKey' as any, 'secret' as any));
    assert.throws(() => second.settings.set('language', 'unknown' as any));
    second.close();
    const inspect = new DatabaseSync(file);
    try {
      assert.equal(inspect.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get()!.n, SCHEMA_VERSION);
      assert.equal(inspect.prepare('PRAGMA journal_mode').get()!.journal_mode, 'wal');
      const tables = inspect.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(row => row.name);
      for (const name of ['settings', 'connections', 'tool_permissions', 'plugin_presets', 'tool_events']) assert.ok(tables.includes(name));
      assert.throws(() => inspect.prepare('INSERT INTO tool_permissions VALUES (?, ?, ?, ?)').run('missing', 'read', 1, 1));
    } finally { inspect.close(); }
  });
});

test('different Windows profiles resolve separate databases and cannot share preferences', async () => {
  await fixture(async folder => {
    const firstPath = localDatabasePath({ APPDATA: path.join(folder, 'user-one') });
    const secondPath = localDatabasePath({ APPDATA: path.join(folder, 'user-two') });
    assert.notEqual(firstPath, secondPath);
    const first = await LocalDatabase.open(firstPath);
    const second = await LocalDatabase.open(secondPath);
    try {
      first.settings.set('language', 'bilingual');
      assert.equal(second.settings.get('language'), undefined);
    } finally { first.close(); second.close(); }
  });
});

test('hosted web startup never creates a local database', async () => {
  await fixture(async folder => {
    const file = path.join(folder, 'web.sqlite');
    assert.equal(await openRuntimeDatabase('web', file), null);
    await assert.rejects(fs.stat(file), { code: 'ENOENT' });
    assert.throws(() => localDatabasePath({ SAMEERA_DATABASE_PATH: 'relative.sqlite' }));
  });
});

test('newer schemas are rejected without deleting existing data or migration versions', async () => {
  await fixture(async folder => {
    const file = path.join(folder, 'future.sqlite');
    const local = await LocalDatabase.open(file);
    local.settings.set('language', 'english');
    local.close();
    let inspect = new DatabaseSync(file);
    inspect.prepare('INSERT INTO schema_migrations VALUES (?, ?)').run(SCHEMA_VERSION + 1, 'future');
    inspect.close();
    await assert.rejects(LocalDatabase.open(file), /Unsupported local database version/);
    inspect = new DatabaseSync(file);
    try {
      assert.equal(inspect.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get()!.n, SCHEMA_VERSION + 1);
      assert.equal(inspect.prepare("SELECT value_json FROM settings WHERE key='language'").get()!.value_json, '"english"');
    } finally { inspect.close(); }
  });
});
