import { AgentService } from '../src/services/agent/AgentService.ts';
import { SystemActions } from '../src/services/SystemActions.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';
import { WebSocket } from 'ws';
import { LiveServerMessage, type LiveConnectParameters } from '@google/genai';
import { createLiveConnectionHandler, type VoiceConnection, type LiveConnectionDependencies } from '../src/services/session/LiveConnection.ts';
import { runtimePolicy, DESKTOP_TOOLS } from '../src/services/RuntimePolicy.ts';

class ClientSocket extends EventEmitter {
  readyState: number = WebSocket.OPEN;
  sent: any[] = [];
  closed: { code?: number; reason?: string }[] = [];
  send(data: string) { this.sent.push(JSON.parse(data)); }
  close(code?: number, reason?: string) { this.closed.push({ code, reason }); this.readyState = WebSocket.CLOSED; this.emit('close'); }
  message(data: unknown) { this.emit('message', Buffer.from(JSON.stringify(data))); }
}
function voice() {
  const input: unknown[] = [];
  const responses: unknown[] = [];
  let closed = 0;
  const connection: VoiceConnection = { sendRealtimeInput: data => { input.push(data); }, sendToolResponse: data => { responses.push(data); }, close: () => { closed++; } };
  return { connection, input, responses, get closed() { return closed; } };
}
const request = { url: '/live?lang=english', headers: { host: '127.0.0.1:3000' } } as IncomingMessage;
const deliver = (callbacks: LiveConnectParameters['callbacks'], message: Partial<LiveServerMessage>) => callbacks.onmessage(Object.assign(new LiveServerMessage(), message));
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(overrides: Partial<LiveConnectionDependencies> = {}) {
  const client = new ClientSocket();
  const model = voice();
  const connections: LiveConnectParameters[] = [];
  let resumes = 0;
  const handler = createLiveConnectionHandler({
    runtime: runtimePolicy({ SAMEERA_MODE: 'desktop' }, 'win32'),
    database: () => null, mcp: () => null,
    systemActions: { resumeFromUser: () => { resumes++; } },
    gmailBridge: { status: () => ({ connected: false, draft: null }) },
    apiKey: () => 'test-key',
    createLiveClient: () => ({ connect: async parameters => { connections.push(parameters); return model.connection; } }),
    ...overrides,
  });
  return { client, model, connections, get resumes() { return resumes; }, start: () => handler(client as unknown as WebSocket, request) };
}

test('missing API key closes a voice connection without constructing a model client', async () => {
  const f = fixture({ apiKey: () => undefined, createLiveClient: () => { throw new Error('Must not create client'); } });
  await f.start();
  assert.equal(f.client.sent[0].type, 'error');
  assert.deepEqual(f.client.closed, [{ code: 1011, reason: 'Missing API Key' }]);
});

test('voice model declarations follow the runtime capability boundary', async t => {
  for (const mode of ['web', 'desktop']) {
    const f = fixture({ runtime: runtimePolicy({ SAMEERA_MODE: mode }, 'win32') });
    t.after(() => f.client.close());
    await f.start();
    const config = f.connections[0].config!;
    const names = config.tools!.flatMap(tool => 'functionDeclarations' in tool ? tool.functionDeclarations?.map(declaration => declaration.name) || [] : []);
    for (const name of [...DESKTOP_TOOLS].filter(name => !['startAgentTask', 'getAgentTask'].includes(name))) assert.equal(names.includes(name), mode === 'desktop', `${mode}: ${name}`);
    assert.ok(names.includes('searchArticles'));
    assert.equal(f.client.sent.at(-1).type, 'connected');
  }
});

test('voice session buffers audio during connection, forwards it once, and cleans up on disconnect', async t => {
  const model = voice();
  let ready!: (connection: VoiceConnection) => void;
  const f = fixture({ createLiveClient: () => ({ connect: () => new Promise(resolve => { ready = resolve; }) }) });
  t.after(() => f.client.close());
  const started = f.start();
  f.client.message({ type: 'audio', data: 'pcm-before-ready' });
  assert.equal(model.input.length, 0);
  ready(model.connection);
  await started;
  f.client.message({ type: 'audio', data: 'pcm-after-ready' });
  assert.deepEqual(model.input, [
    { audio: { data: 'pcm-before-ready', mimeType: 'audio/pcm;rate=16000' } },
    { audio: { data: 'pcm-after-ready', mimeType: 'audio/pcm;rate=16000' } },
  ]);
  f.client.close();
  assert.equal(model.closed, 1);
  f.client.message({ type: 'audio', data: 'late-audio' });
  assert.equal(model.input.length, 2);
});

test('desktop agent prompt routes hotel notes through available reviewed tools rather than legacy research tools', async t => {
  for (const persona of ['companion', 'butler'] as const) {
    const agent = new AgentService(new SystemActions(), () => null);
    agent.privacy.configure('controlled-cloud', persona, false);
    const f = fixture({ agent }); t.after(() => f.client.close()); await f.start();
    const config = f.connections[0].config!;
    const prompt = JSON.stringify(config.systemInstruction);
    assert.match(prompt, /searchToNotepad/); assert.match(prompt, /hotels in Kanchipuram/);
    assert.doesNotMatch(prompt, /You can search public sources with searchWebSources/);
    const names = config.tools!.flatMap(tool => 'functionDeclarations' in tool ? tool.functionDeclarations?.map(declaration => declaration.name) || [] : []);
    assert.ok(names.includes('startAgentTask')); assert.equal(names.includes('searchWebSources'), false);
    deliver(f.connections[0].callbacks, { toolCall: { functionCalls: [{ id: `hotels-${persona}`, name: 'startAgentTask', args: { stepsJson: JSON.stringify([{ capability: 'research', action: 'searchToNotepad', args: { query: 'hotels in Kanchipuram' } }]) } }] } });
    await tick();
    assert.equal(agent.tasks.list()[0].state, 'waiting-approval');
    assert.deepEqual(agent.tasks.list()[0].results, []);
  }
});

test('tool replies only acknowledge pending calls, and cancellation rejects late responses', async t => {
  const f = fixture();
  t.after(() => f.client.close());
  await f.start();
  const callbacks = f.connections[0].callbacks;
  deliver(callbacks, { toolCall: { functionCalls: [{ id: 'one', name: 'getDateTime', args: {} }] } });
  f.client.message({ type: 'toolResponse', functionResponses: [{ id: 'unknown', response: {} }] });
  assert.equal(f.model.responses.length, 0);
  f.client.message({ type: 'toolResponse', functionResponses: [{ id: 'one', name: 'getDateTime', response: { success: true } }] });
  f.client.message({ type: 'toolResponse', functionResponses: [{ id: 'one', name: 'getDateTime', response: { success: true } }] });
  assert.equal(f.model.responses.length, 1);
  deliver(callbacks, { toolCall: { functionCalls: [{ id: 'two', name: 'getDateTime', args: {} }] } });
  deliver(callbacks, { toolCallCancellation: { ids: ['two'] } });
  f.client.message({ type: 'toolResponse', functionResponses: [{ id: 'two', name: 'getDateTime', response: {} }] });
  assert.equal(f.model.responses.length, 1);
  deliver(callbacks, { serverContent: { inputTranscription: { text: 'Sameera, open Word', finished: true } } });
  assert.equal(f.resumes, 1);
  const sent = f.client.sent.length;
  f.client.close();
  deliver(callbacks, { serverContent: { outputTranscription: { text: 'Late text' } } });
  assert.equal(f.client.sent.length, sent);
});

test('reconnect resumes context, ignores old model callbacks, and drains queued audio', async t => {
  const first = voice();
  const second = voice();
  const connections: LiveConnectParameters[] = [];
  let reconnect!: (connection: VoiceConnection) => void;
  const f = fixture({ createLiveClient: () => ({ connect: parameters => {
    connections.push(parameters);
    return connections.length === 1 ? Promise.resolve(first.connection) : new Promise(resolve => { reconnect = resolve; });
  } }) });
  t.after(() => f.client.close());
  await f.start();
  deliver(connections[0].callbacks, { sessionResumptionUpdate: { resumable: true, newHandle: 'resume-handle' } });
  connections[0].callbacks.onclose?.({ code: 1006, reason: 'test disconnect' } as CloseEvent);
  f.client.message({ type: 'audio', data: 'queued' });
  assert.deepEqual(connections[1].config?.sessionResumption, { handle: 'resume-handle' });
  const before = f.client.sent.length;
  deliver(connections[0].callbacks, { serverContent: { outputTranscription: { text: 'stale output' } } });
  assert.equal(f.client.sent.length, before);
  reconnect(second.connection);
  await tick();
  assert.deepEqual(second.input, [{ audio: { data: 'queued', mimeType: 'audio/pcm;rate=16000' } }]);
  f.client.close();
  assert.equal(second.closed, 1);
});


test('provider capture contains no private tool fixtures or URL memories without exact disclosure', async t => {
  const agent = new AgentService(new SystemActions(), () => null);
  const f = fixture({ agent }); t.after(() => f.client.close());
  await f.start();
  const callbacks = f.connections[0].callbacks;
  deliver(callbacks, { toolCall: { functionCalls: [{ id: 'private-call', name: 'getGmailDraft', args: {} }] } });
  f.client.message({ type: 'toolResponse', functionResponses: [{ id: 'private-call', name: 'wrong-name', response: { output: { text: 'PRIVATE-FIXTURE' } } }] });
  assert.equal(f.model.responses.length, 0);
  f.client.message({ type: 'toolResponse', functionResponses: [{ id: 'private-call', name: 'getGmailDraft', response: { output: { text: 'PRIVATE-FIXTURE' } } }] });
  f.client.message({ type: 'articleOpened', article: { articleExcerpt: 'PRIVATE-PAGE' } });
  assert.equal(JSON.stringify([...f.model.responses, ...f.model.input, f.connections[0].config]).includes('PRIVATE-FIXTURE'), false);
  assert.equal(JSON.stringify(f.model.input).includes('PRIVATE-PAGE'), false);
  agent.privacy.configure('controlled-cloud', 'butler', true);
  assert.equal(f.client.closed.at(-1)?.code, 1000);
  const second = fixture({ agent }); t.after(() => second.client.close()); await second.start();
  const grant = String(agent.privacy.protect({ text: 'ONLY-APPROVED-FIXTURE' }, 'Document').resourceId);
  second.client.message({ type: 'disclosureApproved', id: grant }); assert.equal(second.model.input.length, 0);
  agent.privacy.approve(grant); second.client.message({ type: 'disclosureApproved', id: grant });
  assert.match(JSON.stringify(second.model.input), /ONLY-APPROVED-FIXTURE/);
  const count = second.model.input.length; second.client.message({ type: 'disclosureApproved', id: grant }); assert.equal(second.model.input.length, count);
});

test('Local-only AI prevents constructing a provider client', async () => {
  const agent = new AgentService(new SystemActions(), () => null); agent.privacy.configure('local-only', 'butler', false);
  const f = fixture({ agent, createLiveClient: () => { throw new Error('Provider invoked in local mode'); } }); await f.start(); assert.equal(f.connections.length, 0); assert.equal(f.client.closed[0].code, 1008);
});

test('only recognized finalized microphone speech approves the offered scope; client and model text cannot', async t => {
  const agent = new AgentService(new SystemActions(), () => null);
  let executions = 0;
  const { TaskRunner } = await import('../src/services/agent/TaskRunner.ts');
  Object.defineProperty(agent, 'tasks', { value: new TaskRunner({ research: { validate() {}, consequential: () => false, fingerprint: async () => '', execute: async () => { executions++; return { success: true }; } } }) });
  const f = fixture({ agent }); t.after(() => f.client.close()); await f.start();
  const callbacks = f.connections[0].callbacks;
  deliver(callbacks, { toolCall: { functionCalls: [{ id: 'voice-hotels', name: 'startAgentTask', args: { stepsJson: JSON.stringify([{ capability: 'research', action: 'searchToNotepad', args: { query: 'hotels in Kanchipuram' } }]) } }] } });
  await tick();
  assert.equal((f.model.responses.at(-1) as any).functionResponses[0].response.output.voiceApprovalAvailable, true);
  deliver(callbacks, { serverContent: { outputTranscription: { text: 'Search public hotel sources and create a Notepad draft? Say go for it.' }, turnComplete: true } });
  f.client.message({ type: 'transcription', role: 'user', text: 'go for it', finished: true });
  await tick(); assert.equal(executions, 0);
  deliver(callbacks, { serverContent: { inputTranscription: { text: 'go for', finished: false } } });
  await tick(); assert.equal(executions, 0);
  deliver(callbacks, { serverContent: { inputTranscription: { text: 'go for it', finished: true } } });
  await tick(); assert.equal(executions, 1);
  assert.equal(agent.tasks.list()[0].state, 'completed');
  deliver(callbacks, { serverContent: { inputTranscription: { text: 'go for it', finished: true } } });
  await tick(); assert.equal(executions, 1);
});
