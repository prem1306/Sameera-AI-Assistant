import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SystemActions } from '../src/services/SystemActions.ts';

test('Notepad routing preserves Unicode text, separate drafts, and repeated-call protection', async () => {
  const root = path.resolve(process.cwd());
  const folder = await fs.mkdtemp(path.join(root, '.system-actions-test-'));
  const calls: { action: string; args: Record<string, any> }[] = [];
  const actions = new SystemActions(async (action, args) => {
    calls.push({ action, args });
    return { success: true };
  }, folder);
  try {
    const result = await actions.execute('note', 'notepadDraft', { text: 'Hello\nతెలుగు' });
    assert.equal(result.success, true);
    assert.equal(result.verified, true);
    assert.equal(path.dirname(result.path), folder);
    assert.equal(await fs.readFile(result.path, 'utf8'), '\uFEFFHello\r\nతెలుగు');
    assert.equal(calls[0].action, 'notepadOpen');
    assert.equal(calls[0].args.path, result.path);
    assert.equal((await actions.execute('note', 'notepadDraft', { text: 'Different' })).path, result.path);
    assert.equal(calls.length, 1);
  } finally {
    assert.equal(path.dirname(folder), root);
    assert.ok(path.basename(folder).startsWith('.system-actions-test-'));
    await fs.rm(folder, { recursive: true });
  }
});
