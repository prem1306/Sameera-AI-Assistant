import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserBridge } from '../src/services/browser/BrowserBridge.ts';
import { TaskRunner } from '../src/services/agent/TaskRunner.ts';
import { containsSecrets } from '../src/services/privacy/PrivacyService.ts';

test('browser jobs bind one delivery, reject replay and retain results locally', async () => {
  const browser = new BrowserBridge(); browser.next();
  const task = { capability: 'browser', action: 'read', args: { tabId: 17, documentId: 'document-one' } };
  const result = browser.execute(task, new AbortController().signal);
  const job = browser.next()!; assert.equal(job.data.tabId, 17); assert.equal(job.data.documentId, 'document-one'); assert.equal(browser.next(), null);
  browser.result(job.id, { success: true, text: 'PRIVATE-PAGE-FIXTURE' }); assert.equal((await result).text, 'PRIVATE-PAGE-FIXTURE');
  assert.throws(() => browser.result(job.id, { success: true }), /expired/);
  const controller = new AbortController(); const pending = browser.execute(task, controller.signal); const cancelled = browser.next()!; controller.abort();
  assert.equal((await pending).uncertain, true); assert.throws(() => browser.result(cancelled.id, { success: true }));
});

test('browser selections review destination URLs and secrets cannot pass indirect outbound paths', async () => {
  const browser = new BrowserBridge();
  const tasks = new TaskRunner({ browser });
  await assert.rejects(tasks.create([{ capability: 'browser', action: 'select', args: { candidateId: 'opaque', documentId: 'doc' } }]), /destination/);
  for (const value of ['https://example.com/?api_key=secret', 'https://example.com/?access_token%3Dprivate', 'password="private"', { Cookie: 'session=private' }, { nested: { api_key: 'private' } }, 'C:\\Users\\a\\.ssh\\id_rsa']) assert.equal(containsSecrets(value), true);
  await assert.rejects(tasks.create([{ capability: 'browser', action: 'select', args: { candidateId: 'opaque', documentId: 'doc', url: 'https://example.com/?access_token=secret' } }]), /Secret/);
  await assert.rejects(tasks.create([{ capability: 'browser', action: 'evaluate', args: { script: 'deleteEverything()' } }]), /Unsupported/);
});
