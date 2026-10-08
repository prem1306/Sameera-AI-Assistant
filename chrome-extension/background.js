const base = 'http://127.0.0.1:3000';
let busy = false;
let timer;
const drafts = new Map();
const pause = (question) => ({ success: false, needsClarification: true, question });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function inTab(tabId, message) {
  let last;
  for (let count = 0; count < 20; count++) {
    try { return await chrome.tabs.sendMessage(tabId, message); }
    catch (error) { last = error; await sleep(500); }
  }
  throw last;
}
async function run(job) {
  if (job.expires < Date.now()) return pause('This browser request expired. Please repeat it.');
  if (job.action === 'draft') {
    const tabs = await chrome.tabs.query({ url: 'https://mail.google.com/mail/*' });
    // A draft tab counts too: never guess which account/tab the user meant.
    if (tabs.length !== 1) return pause('Please leave exactly one signed-in Gmail tab open in Chrome, then repeat the draft request. I will not select an account for you.');
    const source = tabs[0];
    const account = await inTab(source.id, { type: 'account' });
    if (!account.success) return account;
    if (job.expires < Date.now()) return pause('Draft request expired before Gmail was ready. Please repeat it.');
    const url = new URL(source.url);
    const prefix = url.pathname.match(/^\/mail\/u\/\d+\//)?.[0];
    if (!prefix) return pause('Please open the Gmail inbox for the account you want to use.');
    const compose = new URL('https://mail.google.com' + prefix);
    for (const [key, value] of Object.entries({ view: 'cm', fs: '1', to: job.data.to, su: job.data.subject, body: job.data.body })) compose.searchParams.set(key, value);
    const tab = await chrome.tabs.create({ url: compose.href, active: true });
    let result;
    for (let count = 0; count < 20; count++) {
      if (job.expires < Date.now()) return pause('Draft verification timed out. Please inspect Gmail; nothing was sent.');
      result = await inTab(tab.id, { type: 'verify', mail: job.data, sender: account.sender });
      if (result.success || !result.notReady) break;
      await sleep(500);
    }
    if (!result?.success) return result || pause('Please inspect the draft. Gmail did not confirm its contents.');
    drafts.set(tab.id, { mail: job.data, sender: account.sender });
    return { ...result, tabId: tab.id };
  }
  if (job.action === 'send') {
    const saved = drafts.get(job.data.tabId);
    if (!saved || saved.sender !== job.data.sender || ['to', 'subject', 'body'].some((key) => saved.mail[key] !== job.data[key])) return pause('The browser connection changed. Please inspect Gmail and create a fresh verified draft before sending.');
    // Consume locally too. No retry of a send after a timeout, restart, or uncertain result.
    drafts.delete(job.data.tabId);
    await chrome.tabs.update(job.data.tabId, { active: true });
    return await chrome.tabs.sendMessage(job.data.tabId, { type: 'send', mail: saved.mail, sender: saved.sender, expires: job.expires });
  }
  return pause('Unsupported browser action.');
}
async function poll() {
  if (busy) return;
  busy = true;
  try {
    const { token } = await chrome.storage.local.get('token');
    if (!token) return;
    const headers = { 'Content-Type': 'application/json', 'X-Sameera-Browser-Token': token };
    const response = await fetch(base + '/api/browser/next', { method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(4000) });
    if (!response.ok) { await chrome.action.setBadgeText({ text: '!' }); return; }
    await chrome.action.setBadgeText({ text: 'ON' });
    const { job } = await response.json();
    if (job) {
      let result;
      try { result = await run(job); }
      catch { result = pause(job.action === 'send' ? 'Gmail send could not be confirmed. Check Sent; do not retry automatically.' : 'The Gmail page could not be controlled. Please check it before retrying.'); }
      await fetch(base + '/api/browser/result', { method: 'POST', headers, body: JSON.stringify({ id: job.id, result }), signal: AbortSignal.timeout(4000) });
    }
  } catch { await chrome.action.setBadgeText({ text: '!' }); }
  finally { busy = false; }
}
function start() { clearInterval(timer); timer = setInterval(poll, 2000); void poll(); }
chrome.alarms.create('sameera-poll', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(start);
chrome.runtime.onStartup.addListener(start);
chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type === 'connect') { start(); poll().then(() => respond({ message: 'Pairing saved. Check Connected in Sameera.' })); return true; }
});
start();
