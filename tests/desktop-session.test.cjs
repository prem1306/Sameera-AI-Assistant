const test = require('node:test');
const assert = require('node:assert/strict');
const { isDesktopSender } = require('../desktop/session.cjs');

test('desktop bootstrap rejects setup windows, child frames and navigated documents', () => {
  const origin = 'http://127.0.0.1:3001';
  const frame = { url: origin + '/' };
  const contents = { mainFrame: frame };
  const window = { webContents: contents };
  const event = { sender: contents, senderFrame: frame };
  assert.equal(isDesktopSender(event, window, origin), true);
  assert.equal(isDesktopSender(event, null, origin), false);
  assert.equal(isDesktopSender({ ...event, sender: {} }, window, origin), false);
  assert.equal(isDesktopSender({ ...event, senderFrame: { url: origin + '/' } }, window, origin), false);
  for (const url of [origin + '/setup.html', origin + '/?other', origin + '/#other', 'https://example.com/', 'http://127.0.0.1:3002/', 'http://localhost:3001/']) {
    frame.url = url;
    assert.equal(isDesktopSender(event, window, origin), false, url);
  }
});
