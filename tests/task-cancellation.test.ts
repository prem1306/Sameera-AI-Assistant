import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskRunner, type Adapter } from '../src/services/agent/TaskRunner.ts';
import { SystemActions } from '../src/services/SystemActions.ts';
import { SystemAdapter } from '../src/services/agent/SystemAdapter.ts';

test('cancelled queued system actions never start, including through SystemAdapter', async () => {
  let release!: () => void, calls = 0;
  const actions = new SystemActions(async () => { calls++; await new Promise<void>(resolve => { release = resolve; }); return { success: true }; });
  const first = actions.execute('first', 'openApplication', { application: 'Editor' });
  await new Promise(resolve => setImmediate(resolve));
  const tasks = new TaskRunner({ system: new SystemAdapter(actions) });
  const task = await tasks.create([{ capability: 'system', action: 'openApplication', args: { application: 'Calculator' } }]);
  const running = tasks.approve(task.id);
  tasks.cancel(task.id);
  assert.equal(tasks.get(task.id).state, 'uncertain');
  release(); await first; await running;
  assert.equal(calls, 1);
  assert.equal(tasks.get(task.id).state, 'cancelled');
  assert.equal(tasks.get(task.id).results[0].notExecuted, true);
  await assert.rejects(tasks.approve(task.id));
});

test('stopping an in-flight write retains uncertainty and its late receipt without running another step', async () => {
  let release!: (result: Record<string, any>) => void, calls = 0;
  const adapter: Adapter = { validate() {}, consequential: () => false, fingerprint: async () => '', execute: async () => { calls++; return new Promise(resolve => { release = resolve; }); } };
  const tasks = new TaskRunner({ mock: adapter });
  const task = await tasks.create([{ capability: 'mock', action: 'write', args: {} }, { capability: 'mock', action: 'next', args: {} }]);
  const running = tasks.approve(task.id); tasks.cancel(task.id);
  assert.equal(tasks.get(task.id).state, 'uncertain');
  release({ success: true, receipt: 'external write completed' }); await running;
  tasks.cancel(task.id); tasks.cancelAll();
  assert.equal(tasks.get(task.id).state, 'uncertain');
  assert.equal(tasks.get(task.id).results[0].receipt, 'external write completed');
  assert.equal(calls, 1); await assert.rejects(tasks.approve(task.id));
});

test('execution exceptions are uncertain, while cancellation before approval has no execution', async () => {
  let calls = 0;
  const adapter: Adapter = { validate() {}, consequential: () => false, fingerprint: async () => '', execute: async () => { calls++; throw new Error('receipt lost after write'); } };
  const tasks = new TaskRunner({ mock: adapter });
  const task = await tasks.create([{ capability: 'mock', action: 'write', args: {} }]);
  await tasks.approve(task.id); assert.equal(tasks.get(task.id).state, 'uncertain');
  const pending = await tasks.create([{ capability: 'mock', action: 'write', args: {} }]);
  tasks.cancel(pending.id); await assert.rejects(tasks.approve(pending.id));
  assert.equal(tasks.get(pending.id).state, 'cancelled'); assert.equal(calls, 1);
});
