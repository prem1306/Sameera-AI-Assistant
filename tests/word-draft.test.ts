import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SystemActions } from '../src/services/SystemActions.ts';

test('new Word drafts need no user path, stay separate, and repeated call IDs do not duplicate documents', async () => {
  const root = path.resolve(process.cwd());
  const folder = await fs.mkdtemp(path.join(root, '.system-actions-test-'));
  const calls: any[] = [];
  const actions = new SystemActions(async (action, args) => {
    calls.push({ action, args });
    await fs.writeFile(args.path, 'mock native document');
    return { success: true, verified: true };
  }, folder);
  try {
    const text = 'Machine learning\n\n' + 'learning '.repeat(310) + 'తెలుగు';
    const result = await actions.execute('essay', 'wordDraft', { text, minimumWords: 300 });
    assert.equal(result.success, true);
    assert.equal(result.draft, true);
    assert.ok(result.wordCount >= 300);
    assert.equal(calls[0].action, 'wordDraft');
    assert.equal(calls[0].args.text, text.trim());
    assert.equal(path.dirname(path.dirname(result.path)), folder);
    assert.equal((await actions.execute('essay', 'wordDraft', { text, minimumWords: 300 })).path, result.path);
    assert.equal(calls.length, 1);
  } finally {
    assert.equal(path.dirname(folder), root);
    assert.ok(path.basename(folder).startsWith('.system-actions-test-'));
    await fs.rm(folder, { recursive: true });
  }
});

test('insufficient essay text is rejected before Word starts and can be expanded without user clarification', async () => {
  let called = false;
  const actions = new SystemActions(async () => { called = true; return { success: true }; });
  const result = await actions.execute('short', 'wordDraft', { text: 'A short essay.', minimumWords: 300 });
  assert.equal(result.requiresMoreText, true);
  assert.equal(result.needsClarification, undefined);
  assert.equal(called, false);
});

test('an unverified native write cannot be reported as a completed Word draft', async () => {
  const root = path.resolve(process.cwd());
  const folder = await fs.mkdtemp(path.join(root, '.system-actions-test-'));
  try {
    const actions = new SystemActions(async () => ({ success: true }), folder);
    const result = await actions.execute('unverified', 'wordDraft', { text: 'Document body.' });
    assert.equal(result.success, false);
    assert.equal(result.needsClarification, true);
  } finally {
    assert.equal(path.dirname(folder), root);
    assert.ok(path.basename(folder).startsWith('.system-actions-test-'));
    await fs.rm(folder, { recursive: true });
  }
});
