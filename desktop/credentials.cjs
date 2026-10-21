// Key formats are owned by Google; do not assume only the legacy alphabet.
function normalizeKey(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return /^(['"])(.*)\1$/.test(trimmed) ? trimmed.slice(1, -1).trim() : trimmed;
}

function isKeyInput(key) {
  return typeof key === 'string' && /^[\x21-\x7e]{20,1024}$/.test(key);
}

module.exports = { normalizeKey, isKeyInput };
