import test from 'node:test';
import assert from 'node:assert/strict';
import { windowsPowerShell } from '../src/services/system/WindowsPowerShell.ts';

test('native PowerShell launches use the Windows system directory regardless of PATH', () => {
  assert.equal(windowsPowerShell({ SystemRoot: 'D:\\Windows', PATH: 'C:\\Untrusted' }), 'D:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  assert.equal(windowsPowerShell({ WINDIR: 'C:\\Windows' }), windowsPowerShell({}));
  for (const SystemRoot of ['relative', '\\\\server\\windows', 'C:\\Windows\nother']) assert.throws(() => windowsPowerShell({ SystemRoot }));
});
