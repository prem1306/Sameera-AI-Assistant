const test = require('node:test');
const assert = require('node:assert/strict');
const { isExternalUrl, isAppUrl } = require('../desktop/policy.cjs');
const { createLogger } = require('../desktop/logging.cjs');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('desktop external links reject executable protocols, credentials and loopback destinations', () => {
  assert.equal(isExternalUrl('https://aistudio.google.com/apikey'), true);
  assert.equal(isExternalUrl('https://www.youtube.com/watch?v=test'), true);
  for (const url of ['file:///C:/Windows/System32/cmd.exe', 'javascript:alert(1)', 'ms-settings:privacy', 'https://user:password@example.com', 'http://127.0.0.1:3001', 'http://localhost:3000', 'http://[::1]:3000', 'http://2130706433']) assert.equal(isExternalUrl(url), false, url);
});
test('desktop navigation remains on the exact local app origin', () => {
  const origin = 'http://127.0.0.1:3001';
  assert.equal(isAppUrl(origin + '/?lang=te', origin), true);
  for (const url of ['http://127.0.0.1:3000', 'http://127.0.0.1.evil.test:3001', 'https://example.com', 'file:///index.html', 'not a URL']) assert.equal(isAppUrl(url, origin), false);
});
test('desktop logging works without a terminal and tolerates an unwritable destination', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'sameera-log-test-'));
  const logger = createLogger(folder);
  logger('The desktop app started');
  assert.match(fs.readFileSync(path.join(folder, 'desktop.log'), 'utf8'), /The desktop app started/);
  const blocked = path.join(folder, 'blocked');
  fs.writeFileSync(blocked, 'This is a file, not a directory.');
  assert.doesNotThrow(() => createLogger(blocked)('diagnostic'));
  fs.unlinkSync(blocked);
  fs.unlinkSync(path.join(folder, 'desktop.log'));
  fs.rmdirSync(folder);
});
