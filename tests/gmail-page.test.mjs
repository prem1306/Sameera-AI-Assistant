import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const code = await fs.readFile(new URL('../chrome-extension/gmail.js', import.meta.url), 'utf8');
const mail = { to: 'recipient@example.com', subject: 'Meeting', body: 'Hello\n\nతెలుగు notes.' };
const sender = 'sender@example.com';
function page(overrides = {}) {
  let handler;
  let clicks = 0;
  const state = { sender, to: mail.to, subject: mail.subject, body: mail.body, attachment: false, bcc: '', confirmation: true, ...overrides };
  const body = { innerText: state.body, querySelector: () => state.attachment ? {} : null };
  const button = { getAttribute: (name) => name === 'aria-label' ? 'Send (Ctrl-Enter)' : null, click: () => { clicks++; root.isConnected = false; } };
  const root = { isConnected: true, querySelectorAll: (selector) => {
    if (selector.includes('g_editable')) return [body];
    if (selector === '[email]') return [{ getAttribute: () => state.to }];
    if (selector.includes('name="bcc"')) return [{ value: state.bcc }];
    if (selector.includes('name="to"')) return [];
    if (selector === '[role="button"]') return [button];
    if (selector.includes('[name="from"]')) return state.from ? [{ textContent: state.from }] : [];
    return [];
  }, querySelector: (selector) => selector.includes('.aQH') && state.attachment ? {} : null };
  const subject = { value: state.subject, closest: () => root };
  const document = { querySelector: () => ({ getAttribute: () => `Google Account: User (${state.sender})` }), querySelectorAll: (selector) => selector.includes('subjectbox') ? [subject] : state.confirmation ? [{ textContent: 'Message sent' }] : [] };
  vm.runInNewContext(code, { document, Date, Promise, setTimeout: (callback) => { callback(); }, chrome: { runtime: { onMessage: { addListener: (fn) => { handler = fn; } } } } });
  const send = (message) => new Promise((resolve) => handler(message, {}, resolve));
  return { send, clicks: () => clicks };
}
test('Gmail page refuses changed recipients, sender, content, CC/BCC, attachments, and expired permission before clicking Send', async () => {
  for (const changed of [{ to: 'wrong@example.com' }, { sender: 'other@example.com' }, { from: 'alias@example.com' }, { from: 'From: unknown' }, { subject: 'Changed' }, { body: 'Unexpected signature' }, { bcc: 'hidden@example.com' }, { attachment: true }, { expired: true }]) {
    const fake = page(changed);
    const result = await fake.send({ type: 'send', mail, sender, expires: changed.expired ? Date.now() - 1 : Date.now() + 10000 });
    assert.equal(result.success, false);
    assert.equal(fake.clicks(), 0);
  }
});
test('draft verification never clicks Send; an approved exact send needs a Gmail confirmation', async () => {
  const fake = page();
  assert.equal((await fake.send({ type: 'verify', mail, sender })).success, true);
  assert.equal(fake.clicks(), 0);
  assert.equal((await fake.send({ type: 'send', mail, sender, expires: Date.now() + 10000 })).success, true);
  assert.equal(fake.clicks(), 1);
  const uncertain = page({ confirmation: false });
  assert.equal((await uncertain.send({ type: 'send', mail, sender, expires: Date.now() + 10000 })).success, false);
  assert.equal(uncertain.clicks(), 1);
});
