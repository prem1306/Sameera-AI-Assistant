import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SystemActions } from '../src/services/SystemActions.ts';

test('Notepad uses a separate Unicode draft, verifies bytes, and repeated calls do not create duplicate notes', async () => {
  const workspace = path.resolve(process.cwd());
  const folder = await fs.mkdtemp(path.join(workspace, '.system-actions-test-'));
  const calls: any[] = [];
  const actions = new SystemActions(async (action, args) => { calls.push({ action, args }); return { success: true }; }, folder);
  try {
    const text = 'Meeting notes\n\n• తెలుగు: రేపు సమావేశం\n• Budget: ₹1,500\nLiteral: ` $(no-shell)';
    const result = await actions.execute('note', 'notepadDraft', { text });
    assert.equal(result.success, true);
    assert.equal(result.verified, true);
    assert.equal(await fs.readFile(result.path, 'utf8'), '\uFEFF' + text.replace(/\n/g, '\r\n'));
    assert.equal(calls[0].action, 'notepadOpen');
    assert.equal(calls[0].args.path, result.path);
    assert.equal((await actions.execute('note', 'notepadDraft', { text })).path, result.path);
    assert.equal(calls.length, 1);
    const launch = await actions.execute('code', 'openApplication', { application: 'VS Code' });
    assert.equal(launch.success, true);
    assert.equal(calls[1].action, 'openApplication');
    assert.equal(calls[1].args.application, 'VS Code');
    assert.equal((await actions.execute('shell', 'openApplication', { application: 'powershell -command arbitrary' })).needsClarification, true);
    assert.equal(calls.length, 2);
  } finally {
    assert.equal(path.dirname(path.resolve(folder)), workspace);
    assert.ok(path.basename(folder).startsWith('.system-actions-test-'));
    await fs.rm(folder, { recursive: true });
  }
});
test('missing and unclear Notepad text pauses without launching or writing', async () => {
  let launched = false;
  const actions = new SystemActions(async () => { launched = true; return { success: true }; });
  assert.equal((await actions.execute('missing', 'notepadDraft', {})).needsClarification, true);
  assert.equal(launched, false);
  actions.resumeFromUser();
  assert.equal((await actions.execute('binary', 'notepadDraft', { text: '\0wrong' })).needsClarification, true);
  assert.equal(launched, false);
});
