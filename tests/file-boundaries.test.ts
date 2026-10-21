import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SystemActions, checkedPath } from '../src/services/SystemActions.ts';
import { validateFileMutation } from '../src/services/system/FilePolicy.ts';
import { SystemAdapter } from '../src/services/agent/SystemAdapter.ts';

test('device names, raw traversal, trailing aliases, streams and controls fail before filesystem access', async () => {
  for (const suffix of ['CON', 'NUL.txt', 'COM1.csv', 'lpt².md', 'conout$.txt', 'folder./note.txt', 'folder /note.txt', '../note.txt', './note.txt', 'bad\nname.txt', 'bad:stream.txt']) {
    await assert.rejects(checkedPath(process.cwd() + path.sep + suffix), { name: 'Error' }, suffix);
  }
  await assert.rejects(checkedPath('\\\\?\\C:\\temp\\note.txt'));
  await assert.rejects(checkedPath('\\\\.\\NUL'));
});

test('file tools reject script creation, edits and disguised rename/copy destinations without changing files', async () => {
  const root = await fs.mkdtemp(path.join(process.cwd(), '.file-boundaries-'));
  try {
    const source = path.join(root, 'note.txt');
    await fs.writeFile(source, 'original');
    for (const extension of ['exe', 'cmd', 'ps1', 'js', 'mjs', 'py', 'lnk', 'url', 'msi', 'reg', 'hta', 'html', 'svg']) {
      const actions = new SystemActions();
      const destination = path.join(root, 'payload.' + extension);
      for (const [action, args] of [
        ['writeText', { path: destination, text: 'payload' }],
        ['rename', { path: source, newName: path.basename(destination) }],
        ['copy', { path: source, destination }],
        ['move', { path: source, destination }],
      ] as const) {
        actions.resumeFromUser();
        assert.equal((await actions.execute(action, action, args)).success, false, extension + ' ' + action);
        assert.equal(await fs.readFile(source, 'utf8'), 'original');
        await assert.rejects(fs.stat(destination), { code: 'ENOENT' });
      }
    }
    const script = path.join(root, 'existing.py'); await fs.writeFile(script, 'original script');
    const actions = new SystemActions();
    for (const action of ['writeText', 'replaceText']) {
      actions.resumeFromUser();
      assert.equal((await actions.execute(action, action, { path: script, text: 'changed', find: 'original', replacement: 'changed' })).success, false);
    }
    assert.equal(await fs.readFile(script, 'utf8'), 'original script');
    assert.ok(!(await fs.readdir(root)).some(name => name.includes('sameera-backup')));
    validateFileMutation('writeText', source);
    validateFileMutation('rename', source, path.join(root, 'renamed.txt'));
  } finally {
    assert.equal(path.dirname(root), process.cwd());
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('EXDEV moves refuse fallback and preserve the original', async t => {
  const root = await fs.mkdtemp(path.join(process.cwd(), '.file-boundaries-'));
  try {
    const source = path.join(root, 'source.txt'), destination = path.join(root, 'destination.txt');
    await fs.writeFile(source, 'keep');
    const mock = t.mock.method(fs, 'rename', async () => { throw Object.assign(new Error('different drive'), { code: 'EXDEV' }); });
    const result = await new SystemActions().execute('move', 'move', { path: source, destination });
    mock.mock.restore();
    assert.equal(result.success, false); assert.match(result.question!, /across drives/);
    assert.equal(await fs.readFile(source, 'utf8'), 'keep');
    await assert.rejects(fs.stat(destination), { code: 'ENOENT' });
  } finally {
    t.mock.restoreAll();
    assert.equal(path.dirname(root), process.cwd());
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('source versions are checked after queue waits and rename destinations invalidate review', async () => {
  const root = await fs.mkdtemp(path.join(process.cwd(), '.file-boundaries-'));
  try {
    const source = path.join(root, 'source.txt'), destination = path.join(root, 'destination.txt');
    for (const action of ['copy', 'move', 'rename']) {
      await fs.writeFile(source, 'reviewed');
      let release!: () => void;
      const actions = new SystemActions(async () => { await new Promise<void>(resolve => { release = resolve; }); return { success: true }; });
      const first = actions.execute('block', 'openApplication', { application: 'Editor' });
      await new Promise(resolve => setImmediate(resolve));
      const adapter = new SystemAdapter(actions);
      const step = { capability: 'system', action, args: { path: source, destination, newName: path.basename(destination) } };
      await adapter.fingerprint(step);
      const pending = adapter.execute(step, new AbortController().signal);
      await fs.writeFile(source, 'changed after approval');
      release(); await first;
      const result = await pending;
      assert.equal(result.success, false); assert.match(result.question!, /changed after review/);
      assert.equal(await fs.readFile(source, 'utf8'), 'changed after approval');
      await assert.rejects(fs.stat(destination), { code: 'ENOENT' });
    }
    const adapter = new SystemAdapter(new SystemActions());
    const step = { capability: 'system', action: 'rename', args: { path: source, newName: 'destination.txt' } };
    const before = await adapter.fingerprint(step);
    await fs.writeFile(destination, 'new unreviewed target');
    assert.notEqual(await adapter.fingerprint(step), before);
  } finally {
    assert.equal(path.dirname(root), process.cwd());
    await fs.rm(root, { recursive: true, force: true });
  }
});
