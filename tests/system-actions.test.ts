import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SystemActions, checkedPath } from '../src/services/SystemActions.ts';

test('app commands support arbitrary installed names, require close targets, and deduplicate side effects', async () => {
  const calls: { action: string; args: Record<string, any> }[] = [];
  const actions = new SystemActions(async (action, args) => { calls.push({ action, args }); return { success: true, launchRequested: true }; });
  assert.equal((await actions.execute('open-obs', 'openApplication', { application: 'OBS Studio' })).success, true);
  await actions.execute('open-obs', 'openApplication', { application: 'OBS Studio' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args.application, 'OBS Studio');
  await actions.execute('list', 'listApplications', { application: 'Adobe' });
  await actions.execute('running', 'listRunningApplications', {});
  await actions.execute('close-obs', 'closeApplication', { application: 'OBS Studio' });
  assert.equal(calls.at(-1)?.args.allInstances, false);
  assert.equal((await actions.execute('missing-close', 'closeApplication', { allInstances: true })).needsClarification, true);
  actions.resumeFromUser();
  assert.equal((await actions.execute('wildcard-close', 'closeApplication', { application: '*', allInstances: true })).needsClarification, true);
  actions.resumeFromUser();
  assert.equal((await actions.execute('stale-selection', 'closeApplication', { processId: 123 })).needsClarification, true);
  actions.resumeFromUser();
  assert.equal((await actions.execute('command', 'openApplication', { executablePath: 'C:\\app.exe --run-command' })).needsClarification, true);
  actions.resumeFromUser();
  assert.equal((await actions.execute('script', 'openApplication', { executablePath: 'C:\\app.ps1' })).needsClarification, true);
  assert.equal(calls.length, 4);
});

test('ambiguous app names pause later actions until the user selects an app', async () => {
  let calls = 0;
  const actions = new SystemActions(async () => { calls++; return { success: false, needsClarification: true, question: 'Which editor?', applications: [{ name: 'Editor A' }, { name: 'Editor B' }] }; });
  assert.equal((await actions.execute('ambiguous-app', 'openApplication', { application: 'Editor' })).needsClarification, true);
  assert.equal((await actions.execute('premature-close', 'closeApplication', { application: 'Editor' })).needsClarification, true);
  assert.equal(calls, 1);
});

test('missing details, credentials and system folders never execute', async () => {
  const actions = new SystemActions();
  assert.equal((await actions.execute('missing', 'openFile', {})).needsClarification, true);
  assert.equal((await actions.execute('volume-missing', 'volume', {})).needsClarification, true);
  assert.equal((await actions.execute('brightness-range', 'brightness', { percent: 101 })).needsClarification, true);
  assert.equal((await actions.execute('chrome-unknown', 'openChrome', { url: 'javascript:alert(1)' })).needsClarification, true);
  await assert.rejects(checkedPath(path.join(process.cwd(), '.env')));
  await assert.rejects(checkedPath(path.join(process.cwd(), '.env.local')));
  await assert.rejects(checkedPath(path.join(process.env.WINDIR || 'C:\\Windows', 'test.txt')));
  await assert.rejects(checkedPath('file.txt'));
});

test('text edits are exact, conflict-aware, version-checked and preserve undo copies', async () => {
  const workspace = path.resolve(process.cwd());
  const folder = await fs.mkdtemp(path.join(workspace, '.system-actions-test-'));
  const file = path.join(folder, 'sample.txt');
  const actions = new SystemActions();
  try {
    assert.equal((await actions.execute('create', 'writeText', { path: file, text: 'Hello Hello' })).success, true);
    const read = await actions.execute('read', 'readText', { path: file });
    assert.equal(read.text, 'Hello Hello');
    const ambiguous = await actions.execute('ambiguous', 'replaceText', { path: file, find: 'Hello', replacement: 'Hi', expectedVersion: read.version });
    assert.equal(ambiguous.needsClarification, true);
    assert.equal(await fs.readFile(file, 'utf8'), 'Hello Hello');
    const premature = await actions.execute('premature', 'rename', { path: file, newName: 'not-authorized.txt' });
    assert.equal(premature.needsClarification, true);
    assert.equal(await fs.readFile(file, 'utf8'), 'Hello Hello');
    actions.resumeFromUser(); // The user explicitly answers: replace all occurrences.
    const edited = await actions.execute('edit', 'replaceText', { path: file, find: 'Hello', replacement: 'Hi', expectedVersion: read.version, replaceAll: true });
    assert.equal(edited.success, true);
    assert.equal(await fs.readFile(file, 'utf8'), 'Hi Hi');
    assert.equal(await fs.readFile(edited.backup, 'utf8'), 'Hello Hello');
    const repeated = await actions.execute('edit', 'replaceText', { path: file, find: 'Hello', replacement: 'Hi', expectedVersion: read.version, replaceAll: true });
    assert.equal(repeated.backup, edited.backup);
    const stale = await actions.execute('stale', 'writeText', { path: file, text: 'Wrong', expectedVersion: read.version });
    assert.equal(stale.needsClarification, true);
    assert.equal(await fs.readFile(file, 'utf8'), 'Hi Hi');
    actions.resumeFromUser();
    const collision = await actions.execute('copy-conflict', 'copy', { path: file, destination: file });
    assert.equal(collision.needsClarification, true);
    assert.equal((await actions.execute('missing-parent', 'createFolder', { path: path.join(folder, 'missing', 'child') })).needsClarification, true);
    actions.resumeFromUser();
    const rename = await actions.execute('rename', 'rename', { path: file, newName: 'renamed.txt' });
    assert.equal(rename.success, true);
    assert.equal(await fs.readFile(rename.destination, 'utf8'), 'Hi Hi');
  } finally {
    // Only delete this test's newly created fixture folder, after resolving its bounds.
    assert.equal(path.dirname(path.resolve(folder)), workspace);
    assert.ok(path.basename(folder).startsWith('.system-actions-test-'));
    await fs.rm(folder, { recursive: true });
  }
});

test('a clarification stops the remaining model-issued actions', async () => {
  const { ToolManager } = await import('../src/services/ToolManager.ts');
  const manager = new ToolManager();
  let calls = 0;
  (manager as any).executeSingleCall = async () => { calls++; return { success: false, needsClarification: true, question: 'Which file?' }; };
  const responses = await manager.executeToolCalls([
    { id: 'one', name: 'performSystemAction', args: {} },
    { id: 'two', name: 'performSystemAction', args: {} },
  ]);
  assert.equal(calls, 1);
  assert.equal(responses[1].response.output.notExecuted, true);
});
