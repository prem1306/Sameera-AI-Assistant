const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setupUi(api) {
  const elements = Object.fromEntries(['setup', 'continue', 'offline', 'description', 'status', 'key', 'h1', 'submit'].map(id => [id, {
    hidden: id === 'continue', disabled: false, textContent: '', value: '',
    listeners: {}, addEventListener(name, handler) { this.listeners[name] = handler; },
  }]));
  const window = { sameeraSetup: api, listeners: {}, addEventListener(name, handler) { this.listeners[name] = handler; } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../desktop/setup.js'), 'utf8'), {
    window, document: { getElementById: id => elements[id], querySelector: selector => elements[selector === 'h1' ? 'h1' : 'submit'] },
  });
  return { elements, window };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('setup recognizes an existing key without exposing it or requiring another paste', async () => {
  let continued = 0;
  const { elements } = setupUi({ keyStatus: async () => ({ hasKey: true }), useSavedKey: async () => { continued++; return { success: true }; } });
  await tick();
  assert.equal(elements.continue.hidden, false);
  assert.equal(elements.h1.textContent, 'Your Gemini key is saved');
  assert.equal(elements.key.value, '');
  await elements.continue.listeners.click();
  assert.equal(continued, 1);
});

test('an idle setup window checks again when focused after a key becomes available', async () => {
  let hasKey = false;
  const { elements, window } = setupUi({ keyStatus: async () => ({ hasKey }) });
  await tick();
  assert.equal(elements.continue.hidden, true);
  hasKey = true;
  await window.listeners.focus();
  assert.equal(elements.continue.hidden, false);
});

test('saving a replacement disables the submit button rather than the saved-key button', async () => {
  let input;
  const { elements } = setupUi({ keyStatus: async () => ({ hasKey: true }), saveKey: async key => { input = key; return { success: true }; } });
  await tick();
  elements.key.value = 'replacement-test-key';
  await elements.setup.listeners.submit({ preventDefault() {} });
  assert.equal(input, 'replacement-test-key');
  assert.equal(elements.submit.disabled, true);
  assert.equal(elements.continue.disabled, false);
  assert.equal(elements.key.value, '');
});

test('saved-key launch errors allow retry and show the actionable message', async () => {
  const { elements } = setupUi({ keyStatus: async () => ({ hasKey: true }), useSavedKey: async () => ({ success: false, message: 'No saved key was found.' }) });
  await tick();
  await elements.continue.listeners.click();
  assert.equal(elements.continue.disabled, false);
  assert.equal(elements.status.textContent, 'No saved key was found.');
});


test('local-only startup needs no API key and never calls the key-saving API', async () => {
  let opened = 0;
  const { elements } = setupUi({ keyStatus: async () => ({ hasKey: false }), useLocalOnly: async () => { opened++; return { success: true }; }, saveKey: async () => { throw new Error('Unexpected credential operation'); } });
  await tick(); await elements.offline.listeners.click(); assert.equal(opened, 1); assert.equal(elements.key.value, '');
});
