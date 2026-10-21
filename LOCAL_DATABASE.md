# Sameera local SQLite

The desktop backend opens SQLite before it starts accepting requests. The installed Electron runtime includes SQLite; users do not install a database service or npm dependencies.

## Storage

Installed Windows path: `%APPDATA%\Sameera\data\sameera.sqlite`. Electron passes its actual per-user data path to the backend. Different Windows accounts have separate files. Development uses the same profile-based default; set an absolute `SAMEERA_DATABASE_PATH` to isolate a development database.

This is storage per Windows account, not a Sameera cloud account. People sharing the same Windows account share its Sameera settings. Web mode, including Vercel, never opens this database.

## Current behavior

- Schema migrations run in a transaction and record applied versions. Reopening is idempotent. Unsupported newer versions fail without resetting data.
- Foreign keys and constraints enforce valid records. WAL mode and a five-second busy timeout handle ordinary desktop contention.
- The preferences repository accepts supported language, theme, persona, privacy mode, memory opt-in and provider-handling confirmation values. Language changes during a live session are persisted; the saved language is a fallback when the client supplies no language.
- Health exposes database readiness and schema version, not contents or the file path.
- Connections, tool permissions, plugin presets, and MCP event metadata are used by the desktop Connections feature. Migration 2 adds non-secret connection configuration and preset manifests while preserving existing preferences. Tool event records contain only names/status/timing, with at most 500 records. Conversation text and tool arguments/results are not recorded.
- API keys and OAuth tokens do not belong in this database. Gemini keys retain their existing encrypted storage. MCP bearer tokens use separate Windows-encrypted files referenced through `credential_ref`.

SQLite itself is not encrypted. Keep conversation text, document contents, tool arguments/results, and credentials out of this initial schema. Normal Windows profile permissions protect access; this is not an encryption guarantee.

Migration 3 adds at most 100 task metadata records: random ID, state and update time. Private task steps and results remain in memory. A restart marks unfinished tasks uncertain; they never automatically resume.

Conversation summaries are disabled by default. Opt-in summaries live separately in `data/memories.bin`, encrypted with Windows DPAPI. There is a 25-summary/64-KB limit, no full transcript or audio retention by default, and a separate review before cloud disclosure. Existing browser memories are preserved until the user imports or deletes them; they are no longer loaded or sent automatically. The UI provides inspect/delete controls. Shared Windows accounts still share the same profile.

Optional offline runtimes and models live under `%APPDATA%\Sameera\local-ai`, outside the app archive. Setup credentials are not persisted there. The version receipt is metadata; the pinned manifests and explicit reinstall perform asset verification.

## Maintenance

Add incremental migrations in `src/services/database/migrations.ts`; never edit a released migration or delete a user's database to resolve version differences. Add feature-specific repositories alongside `SettingsRepository.ts`.

Close Sameera before manually backing up the database folder. Copy the whole `data` folder, including any WAL/SHM companions, together. Never copy a live database file alone. App updates preserve the user-data directory.

Run `npm run lint` and `node --import tsx --test tests/local-database.test.ts`. Packaged smoke checks require database readiness. Development requires Node 22.13 or newer; the installed app uses its bundled runtime.

Implementation uses Node's built-in SQLite API: https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html
