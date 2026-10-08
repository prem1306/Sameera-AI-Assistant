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
