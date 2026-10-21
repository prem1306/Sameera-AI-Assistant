import { readTabOnce } from './browser.js';
const status = document.getElementById('status');
document.getElementById('connect').addEventListener('click', async () => {
  const token = document.getElementById('token').value.trim();
  if (!/^[a-f0-9]{64}$/.test(token)) { status.textContent = 'Paste the complete pairing code.'; return; }
  const serverUrl = document.getElementById('server').value;
  if (!['http://127.0.0.1:3000', 'http://127.0.0.1:3001'].includes(serverUrl)) return;
  await chrome.storage.local.set({ token, serverUrl });
  document.getElementById('token').value = '';
  const result = await chrome.runtime.sendMessage({ type: 'connect' });
  status.textContent = result?.message || 'Connection requested.';
});
void chrome.storage.local.get('serverUrl').then(({ serverUrl }) => { if (serverUrl) document.getElementById('server').value = serverUrl; });
document.getElementById('disconnect').addEventListener('click', async () => {
  await chrome.storage.local.remove('token');
  status.textContent = 'Disconnected.';
});

async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.startsWith('https://')) throw new Error('Choose an HTTPS webpage.');
  return tab;
}
async function action(callback) {
  try { await callback(); } catch (error) { status.textContent = error.message || 'Could not access this page.'; }
}
document.getElementById('grant').addEventListener('click', () => action(async () => {
  const tab = await currentTab();
  const allowed = await chrome.permissions.request({ origins: [new URL(tab.url).origin + '/*'] });
  status.textContent = allowed ? 'This site is available to reviewed Sameera tasks.' : 'Site access was not granted.';
}));
document.getElementById('revoke').addEventListener('click', () => action(async () => {
  const tab = await currentTab(); await chrome.permissions.remove({ origins: [new URL(tab.url).origin + '/*'] });
  status.textContent = 'Site access revoked.';
}));
document.getElementById('read').addEventListener('click', () => action(async () => {
  const tab = await currentTab(); const result = await readTabOnce(tab.id);
  document.getElementById('page').textContent = result.text || result.error || 'No readable text.';
  status.textContent = 'Read locally in this popup. No page text was sent to Google.';
}));
