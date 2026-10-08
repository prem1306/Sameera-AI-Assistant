document.getElementById('setup').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = document.querySelector('button');
  const status = document.getElementById('status');
  button.disabled = true;
  status.textContent = 'Saving…';
  try {
    const result = await window.sameeraSetup.saveKey(document.getElementById('key').value);
    if (!result.success) throw new Error(result.message);
    document.getElementById('key').value = '';
    status.textContent = 'Saved. Opening Sameera…';
  } catch (error) { status.textContent = error.message || 'Could not save the key.'; button.disabled = false; }
});
