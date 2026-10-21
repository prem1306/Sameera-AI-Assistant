const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeKey, isKeyInput } = require('../desktop/credentials.cjs');

test('setup accepts legacy keys and punctuation in newer provider key formats', () => {
  for (const key of ['AIza' + 'x'.repeat(35), 'AQ.' + 'x'.repeat(80), 'prefix.' + 'x'.repeat(300)]) {
    assert.equal(isKeyInput(normalizeKey(key)), true);
  }
});

test('setup removes surrounding copy whitespace and matching quotes', () => {
  const key = 'AQ.' + 'x'.repeat(80);
  for (const input of [`  ${key}\r\n`, `"${key}"`, `'${key}'`]) assert.equal(normalizeKey(input), key);
});

test('setup rejects empty input, embedded whitespace, controls and oversized values', () => {
  for (const input of [undefined, '', 'too-short', 'x'.repeat(20) + '\n' + 'x'.repeat(20), 'x'.repeat(20) + ' ' + 'x'.repeat(20), 'x'.repeat(20) + '\0', 'x'.repeat(1025)]) {
    assert.equal(isKeyInput(normalizeKey(input)), false);
  }
});
