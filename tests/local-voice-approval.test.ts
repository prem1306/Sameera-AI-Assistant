import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { WebSocket } from 'ws';
import { localConnection } from '../src/services/local/LocalConnection.ts';
import type { LocalRuntime } from '../src/services/local/Runtime.ts';
import { AgentService } from '../src/services/agent/AgentService.ts';
import { TaskRunner } from '../src/services/agent/TaskRunner.ts';
import { SystemActions } from '../src/services/SystemActions.ts';
import type { IncomingMessage } from 'node:http';

test('offline voice confirms through local transcription without replanning consent', async t => {
  const socket = Object.assign(new EventEmitter(), { readyState: WebSocket.OPEN as number, send(_text: string) {}, close() { socket.emit('close'); } });
  const agent = new AgentService(new SystemActions(), () => null);
  let executions = 0, plans = 0;
  Object.defineProperty(agent, 'tasks', { value: new TaskRunner({ research: { validate() {}, consequential: () => false, fingerprint: async () => '', execute: async () => { executions++; return { success: true }; } } }) });
  const speech = ['Search hotels in Kanchipuram and note them down', 'go for it'];
  const runtime = {
    status: async () => ({ ready: true }),
    exclusive: async (operation: (signal: AbortSignal) => Promise<void>, signal: AbortSignal) => operation(signal),
    transcribe: async () => speech.shift()!,
    reason: async () => { plans++; return { reply: 'I can research hotels.', steps: [{ capability: 'research', action: 'searchToNotepad', args: { query: 'hotels in Kanchipuram' } }] }; },
    speak: async () => ({ audio: 'AAAA' }),
  } as unknown as LocalRuntime;
  await localConnection(runtime, agent)(socket as unknown as WebSocket, { url: '/local-live?lang=english' } as IncomingMessage);
  t.after(() => socket.close());
  const say = async () => {
    for (const message of [{ type: 'speechActivity', active: true }, { type: 'audio', data: 'AAAA' }, { type: 'speechActivity', active: false }]) socket.emit('message', Buffer.from(JSON.stringify(message)));
    await new Promise(resolve => setImmediate(resolve));
  };
  await say(); assert.equal(executions, 0); assert.equal(agent.tasks.list()[0].state, 'waiting-approval');
  await say(); assert.equal(executions, 1); assert.equal(plans, 1); assert.equal(agent.tasks.list()[0].state, 'completed');
});

