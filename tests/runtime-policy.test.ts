import assert from 'node:assert/strict';
import test from 'node:test';
import { runtimePolicy, requestAllowed, toolsForMode } from '../src/services/RuntimePolicy.ts';
import { isPublicAddress, fetchPublicPage } from '../src/services/PublicWeb.ts';

test('hosted mode disables PC, Gmail and MCP tools even on Windows', () => {
  assert.equal(runtimePolicy({ SAMEERA_MODE: 'web' }, 'win32').windowsControls, false);
  assert.equal(runtimePolicy({ SAMEERA_MODE: 'desktop' }, 'win32').gmailBridge, true);
  assert.equal(runtimePolicy({}, 'linux').mode, 'web');
  assert.throws(() => runtimePolicy({ SAMEERA_MODE: 'unknown' }));
  assert.deepEqual(toolsForMode([{ name: 'performSystemAction' }, { name: 'draftGmailMail' }, { name: 'listConnectedTools' }, { name: 'callConnectedTool' }, { name: 'searchArticles' }], false), [{ name: 'searchArticles' }]);
});
test('public hosting accepts its own origin and rejects other origins', () => {
  assert.equal(requestAllowed('sameera.replit.app', 'https://sameera.replit.app', true, 3000), true);
  assert.equal(requestAllowed('sameera.replit.app', 'https://evil.test', true, 3000), false);
  assert.equal(requestAllowed('evil.test', undefined, true, 3000, 'sameera.replit.app'), false);
  assert.equal(requestAllowed('sameera.replit.app', undefined, false, 3000), false);
  assert.equal(requestAllowed('127.0.0.1:3000', 'http://127.0.0.1:3000', false, 3000), true);
});
test('article reader rejects private, loopback, metadata and reserved addresses', async () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '172.16.2.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::ffff:127.0.0.1', 'fc00::1', '2001:db8::1', '2002:7f00:1::']) assert.equal(isPublicAddress(address), false, address);
  for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) assert.equal(isPublicAddress(address), true, address);
  await assert.rejects(fetchPublicPage('http://127.0.0.1:3000'), /public/);
  await assert.rejects(fetchPublicPage('http://169.254.169.254'), /public/);
  await assert.rejects(fetchPublicPage('https://user:password@example.com'), /public/);
});
