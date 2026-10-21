import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createTestServer } from './fixtures/mcp-server.mjs';
import { LocalDatabase } from '../src/services/database/LocalDatabase.ts';
import { CredentialStore } from '../src/services/mcp/CredentialStore.ts';
import { ConnectionManager } from '../src/services/mcp/ConnectionManager.ts';
import { ToolExecutor } from '../src/services/mcp/ToolExecutor.ts';
import { validateConfig } from '../src/services/mcp/ConnectionConfig.ts';
import { parsePlugin } from '../src/services/plugins/PluginManifest.ts';
import { VoiceToolSession } from '../src/services/mcp/VoiceToolSession.ts';
import type { McpService } from '../src/services/mcp/McpService.ts';

async function fixture(run: (database: LocalDatabase, manager: ConnectionManager, folder: string) => Promise<void>) {
  const root = process.cwd();
  const folder = await fs.mkdtemp(path.join(root, '.system-actions-test-'));
  const database = await LocalDatabase.open(path.join(folder, 'test.sqlite'));
  const secrets = new CredentialStore(path.join(folder, 'secrets'), async (operation, value) => operation === 'protect' ? Buffer.from(value).toString('base64') : Buffer.from(value, 'base64').toString());
  const manager = new ConnectionManager(database.connections, secrets);
  try { await run(database, manager, folder); }
  finally { await manager.close(); database.close(); assert.equal(path.dirname(folder), root); await fs.rm(folder, { recursive: true }); }
}

test('voice proposals in every language require exact local approval and never repeat a call', async () => {
  await fixture(async (database, manager) => {
    const connection = database.connections.add('Local echo', { transport: 'stdio', command: process.execPath, args: [path.resolve('tests/fixtures/mcp-server.mjs'), '--stdio'] });
    await manager.connect(connection.id);
    database.connections.setPermission(connection.id, 'echo', true);
    const executor = new ToolExecutor(manager);
    const service = { executor, catalog: () => manager.state().filter(row => row.enabled && row.status === 'connected').map(row => ({ id: row.id, name: row.name, tools: row.tools.filter(tool => tool.enabled) })) } as unknown as McpService;
    let now = Date.now();
    const voice = new VoiceToolSession(service, () => now);
    const call = (id: string) => ({ id, name: 'callConnectedTool', args: { connectionId: connection.id, toolName: 'echo', argumentsJson: '{"message":"Hello"}', userExplicitlyAuthorized: true } });
    voice.input('Hey Samira, use '); voice.input('Local echo to say Hello.', true);
    await voice.execute({ id: 'catalog', name: 'listConnectedTools' });
    const result = await voice.execute(call('direct'));
    assert.equal(result.requiresUserApproval, true);
    assert.equal(result.authorization, undefined);
    assert.equal(database.connections.history().length, 0);
    const approved = await executor.approve(String(result.requestId));
    assert.equal(approved.success, true);
    assert.match(JSON.stringify(approved.output), /Echo: Hello/);
    assert.deepEqual(await voice.execute(call('direct')), result);
    assert.equal(database.connections.history().length, 1);
    assert.equal((await voice.execute(call('repeat'))).requiresUserApproval, true);
    voice.input('Tell me a joke.');
    assert.equal((await voice.execute(call('implicit'))).requiresUserApproval, true);
    for (const text of ['Do not use echo.', 'Explain how to use echo.', 'Use "echo" as an example.', 'Can echo help with this?', 'Use Local echo instead of running it.', 'ఈ సాధనాన్ని ఉపయోగించు', 'இந்த கருவியை இயக்கு', 'ഈ ഉപകരണം ഉപയോഗിക്കുക', 'ಈ ಸಾಧನವನ್ನು ಬಳಸು', 'इस उपकरण का उपयोग करें']) {
      voice.input(text);
      // An explanation is not an instruction to execute.
      const proposal = await voice.execute(call(text));
      assert.equal(proposal.requiresUserApproval, true, text); executor.cancel(String(proposal.requestId));
    }
    voice.input('Use echo to say Hello.');
    now += 120001;
    assert.equal((await voice.execute(call('expired'))).requiresUserApproval, true);
    // UI/API requests still always require exact-request approval.
    assert.equal(executor.request('manual', connection.id, 'echo', { message: 'Hello' }).requiresUserApproval, true);
  });
});

test('MCP local process discovers tools, enforces permissions, reviews calls, and deduplicates approval', async () => {
  await fixture(async (database, manager) => {
    const connection = database.connections.add('Local echo', { transport: 'stdio', command: process.execPath, args: [path.resolve('tests/fixtures/mcp-server.mjs'), '--stdio'] });
    await manager.connect(connection.id);
    assert.equal(manager.state()[0].status, 'connected');
    const executor = new ToolExecutor(manager);
    assert.throws(() => executor.request('one', connection.id, 'echo', { message: 'Hello' }), /disabled/);
    database.connections.setPermission(connection.id, 'echo', true);
    assert.throws(() => executor.request('bad', connection.id, 'echo', { wrong: true }), /schema/);
    const prepared = executor.request('one', connection.id, 'echo', { message: 'Hello' });
    assert.equal(prepared.requiresUserApproval, true);
    assert.equal(database.connections.history().length, 0);
    const first = await executor.approve('one');
    assert.equal(first.success, true);
    assert.match(JSON.stringify(first.output), /Echo: Hello/);
    assert.deepEqual(await executor.approve('one'), first);
    assert.equal(database.connections.history().length, 1);
    executor.request('cancel', connection.id, 'echo', { message: 'Never run' });
    executor.cancel('cancel');
    assert.equal((await executor.approve('cancel')).cancelled, true);
    assert.equal(database.connections.history().length, 1);
    executor.request('revoked', connection.id, 'echo', { message: 'Never run' });
    database.connections.setPermission(connection.id, 'echo', false);
    await assert.rejects(executor.approve('revoked'), /disabled/);
    database.connections.setPermission(connection.id, 'echo', true);
    executor.request('failure', connection.id, 'echo', { message: 'fail' });
    assert.equal((await executor.approve('failure')).success, false);
    assert.equal(database.connections.history()[0].status, 'failed');
  });
});

test('remote Streamable HTTP MCP connects through explicit localhost permission', async () => {
  let calls = 0;
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const mcp = createTestServer(() => calls++);
    await mcp.connect(transport);
    res.on('close', () => { void mcp.close(); });
    await transport.handleRequest(req, res, body);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await fixture(async (database, manager) => {
      const port = (server.address() as any).port;
      const row = database.connections.add('Remote echo', { transport: 'http', url: `http://127.0.0.1:${port}/mcp`, allowLocalhost: true });
      await manager.connect(row.id);
      database.connections.setPermission(row.id, 'echo', true);
      const executor = new ToolExecutor(manager);
      executor.request('http-call', row.id, 'echo', { message: 'Remote' });
      assert.equal(calls, 0);
      assert.equal((await executor.approve('http-call')).success, true);
      assert.equal(calls, 1);
      await executor.approve('http-call');
      assert.equal(calls, 1);
    });
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('endpoint validation rejects private networks and embedded credentials; plugins are data presets', () => {
  assert.throws(() => validateConfig({ transport: 'http', url: 'https://user:secret@example.com/mcp' }));
  assert.throws(() => validateConfig({ transport: 'http', url: 'https://10.0.0.1/mcp' }));
  assert.throws(() => validateConfig({ transport: 'http', url: 'http://localhost:8080/mcp' }));
  assert.throws(() => validateConfig({ transport: 'http', url: 'https://example.com/mcp?token=secret' }));
  assert.throws(() => validateConfig({ transport: 'stdio', command: 'cmd.exe', args: [] }));
  const plugin = parsePlugin({ version: 1, name: 'Example', description: 'Example tools', connection: { transport: 'http', url: 'https://example.com/mcp', allowLocalhost: false }, arbitraryCode: 'ignored' });
  assert.equal(Object.hasOwn(plugin, 'arbitraryCode'), false);
  assert.throws(() => parsePlugin({ version: 2 }));
});

test('token storage stores only codec output and can be deleted independently of SQLite', async () => {
  await fixture(async (_database, _manager, folder) => {
    const id = randomUUID();
    const store = new CredentialStore(path.join(folder, 'vault'), async (operation, value) => operation === 'protect' ? 'encrypted:' + Buffer.from(value).toString('base64') : Buffer.from(value.slice(10), 'base64').toString());
    await store.set(id, 'test-token-not-real');
    assert.equal(await store.get(id), 'test-token-not-real');
    assert.doesNotMatch(await fs.readFile(path.join(folder, 'vault', `${id}.bin`), 'utf8'), /test-token-not-real/);
    await store.remove(id);
    assert.equal(await store.get(id), undefined);
    await assert.rejects(store.get('../bad-reference'));
  });
});


test('reconnecting an MCP server invalidates pending approvals', async () => {
  await fixture(async (database, manager) => {
    const row = database.connections.add('Echo', { transport: 'stdio', command: process.execPath, args: [path.resolve('tests/fixtures/mcp-server.mjs'), '--stdio'] });
    await manager.connect(row.id); database.connections.setPermission(row.id, 'echo', true);
    const executor = new ToolExecutor(manager); executor.request('old-session', row.id, 'echo', { message: 'PRIVATE' });
    await manager.disconnect(row.id); await manager.connect(row.id);
    await assert.rejects(executor.approve('old-session'), /Connection changed/);
    assert.equal(database.connections.history().length, 0);
  });
});
