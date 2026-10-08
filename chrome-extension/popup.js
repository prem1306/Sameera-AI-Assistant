const status = document.getElementById('status');
document.getElementById('connect').addEventListener('click', async () => {
  const token = document.getElementById('token').value.trim();
  if (!/^[a-f0-9]{64}$/.test(token)) { status.textContent = 'Paste the complete pairing code.'; return; }
  await chrome.storage.local.set({ token });
  document.getElementById('token').value = '';
  const result = await chrome.runtime.sendMessage({ type: 'connect' });
  status.textContent = result?.message || 'Connection requested.';
});
document.getElementById('disconnect').addEventListener('click', async () => {
  await chrome.storage.local.remove('token');
  status.textContent = 'Disconnected.';
});
