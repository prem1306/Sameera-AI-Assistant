async function refreshKeyStatus() {
  try {
    const result = await window.sameeraSetup.keyStatus();
    document.getElementById('continue').hidden = !result.hasKey;
    if (result.hasKey) {
      document.querySelector('h1').textContent = 'Your Gemini key is saved';
      document.getElementById('description').textContent = 'Continue with your saved key, or paste a replacement below. Your key stays encrypted for your Windows account.';
    }
    if (result.message) document.getElementById('status').textContent = result.message;
  } catch { document.getElementById('status').textContent = 'Could not check your saved key. Close and reopen Sameera to try again.'; }
}
void refreshKeyStatus();
window.addEventListener('focus', refreshKeyStatus);
document.getElementById('continue').addEventListener('click', async () => {
  const button = document.getElementById('continue');
  button.disabled = true;
  try {
    const result = await window.sameeraSetup.useSavedKey();
    if (!result.success) throw new Error(result.message);
  } catch (error) {
    document.getElementById('status').textContent = error.message || 'Could not open Sameera.';
    button.disabled = false;
  }
});
document.getElementById('setup').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = document.querySelector('button[type="submit"]');
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

document.getElementById('offline').addEventListener('click', async () => {
  const button = document.getElementById('offline'); button.disabled = true;
  try { const result = await window.sameeraSetup.useLocalOnly(); if (!result.success) throw new Error(result.message); }
  catch { document.getElementById('status').textContent = 'Could not open Local-only AI. Close and reopen Sameera.'; button.disabled = false; }
});
