import test from 'node:test';
import assert from 'node:assert/strict';
import { GmailBridge } from '../src/services/GmailBridge.ts';

const mail = { to: 'recipient@example.com', subject: 'Meeting notes', body: 'Hello,\n\nతెలుగు notes — thank you.' };
function finishDraft(bridge: GmailBridge) {
  const job = bridge.next();
  assert.equal(job?.action, 'draft');
  assert.equal(bridge.finish(job!.id, { success: true, ...mail, sender: 'sender@example.com', tabId: 17 }), true);
}
test('mail drafting requires exact details and a connected browser', async () => {
  const bridge = new GmailBridge();
  assert.equal((await bridge.prepare('missing', { ...mail, to: 'Alex' })).needsClarification, true);
  assert.equal((await bridge.prepare('disconnected', mail)).needsClarification, true);
  assert.equal(bridge.requestApproval().success, false);
  assert.equal((await bridge.approve('invented')).needsClarification, true);
  assert.equal(bridge.next(), null); // No send job or draft on missing details.
});
test('drafting cannot send; permission is exact, consumed once, and explicit', async () => {
  const bridge = new GmailBridge();
  bridge.next();
  const preparing = bridge.prepare('draft-one', mail);
  finishDraft(bridge);
  const result = await preparing;
  assert.equal(result.success, true);
  assert.equal((await bridge.prepare('draft-one', { ...mail, body: 'duplicate changed input' })).draft.id, result.draft.id);
  assert.equal(bridge.next(), null);
  assert.equal((await bridge.approve(result.draft.id)).needsClarification, true);
  bridge.requestApproval();
  const sending = bridge.approve(result.draft.id);
  const job = bridge.next();
  assert.equal(job?.action, 'send');
  assert.deepEqual({ to: job!.data.to, subject: job!.data.subject, body: job!.data.body }, mail);
  assert.equal((await bridge.approve(result.draft.id)).needsClarification, true);
  bridge.finish(job!.id, { success: true, message: 'Gmail confirmed: Message sent.' });
  assert.equal((await sending).success, true);
  assert.equal(bridge.status().draft?.state, 'sent');
  assert.equal(bridge.next(), null);
});
test('new drafts and cancelled/expired approvals cannot authorize a send', async () => {
  const bridge = new GmailBridge();
  bridge.next();
  const first = bridge.prepare('first', mail);
  finishDraft(bridge);
  const old = (await first).draft;
  bridge.requestApproval();
  bridge.cancelApproval(old.id);
  assert.equal((await bridge.approve(old.id)).needsClarification, true);
  bridge.requestApproval();
  old.approvalExpires = Date.now() - 1;
  assert.equal((await bridge.approve(old.id)).needsClarification, true);
  const second = bridge.prepare('second', mail);
  finishDraft(bridge);
  const current = (await second).draft;
  bridge.requestApproval();
  assert.equal((await bridge.approve(old.id)).needsClarification, true);
  assert.equal(bridge.status().draft?.id, current.id);
  assert.equal(bridge.next(), null);
});
test('changed or unverifiable Gmail contents invalidate permission and uncertain sends never retry', async () => {
  const bridge = new GmailBridge();
  bridge.next();
  const prepare = bridge.prepare('valid', mail);
  finishDraft(bridge);
  const draft = (await prepare).draft;
  bridge.requestApproval();
  const send = bridge.approve(draft.id);
  const job = bridge.next();
  bridge.finish(job!.id, { success: false, needsClarification: true, question: 'Message changed. Inspect Gmail.' });
  assert.equal((await send).success, false);
  assert.equal(bridge.status().draft?.state, 'unknown');
  assert.equal((await bridge.approve(draft.id)).needsClarification, true);
  assert.equal(bridge.requestApproval().success, false);
  assert.equal(bridge.next(), null);
  const bad = bridge.prepare('bad', mail);
  const draftJob = bridge.next();
  bridge.finish(draftJob!.id, { success: true, ...mail, body: 'Unexpected signature', sender: 'sender@example.com', tabId: 17 });
  assert.equal((await bad).needsClarification, true);
  assert.equal(bridge.status().draft, null);
});
