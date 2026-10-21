import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const nativeFiles = ['windows-actions.ps1', 'windows-apps.ps1', 'windows-word.ps1', 'windows-notepad.ps1', 'windows-credentials.ps1', 'windows-word-inspect.ps1', 'expand-local-package.ps1', 'local-speech.py', 'WindowsAudio.cs'];

export async function checkDesktopPackage(target = path.join(root, 'build', 'desktop-app')) {
  const archived = target.endsWith('.asar');
  const asar = archived ? require('@electron/asar') : undefined;
  const walk = async (directory, prefix = '') => {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      assert.ok(!entry.isSymbolicLink(), 'Package must not contain filesystem links.');
      const relative = path.posix.join(prefix, entry.name);
      if (entry.isDirectory()) files.push(...await walk(path.join(directory, entry.name), relative));
      else files.push(relative);
    }
    return files;
  };
  const entries = archived ? asar.listPackage(target).map(name => name.replaceAll('\\', '/').replace(/^\//, '')) : await walk(target);
  for (const entry of entries) {
    assert.ok(!/(?:^|\/)(?:\.env(?:\.[^/]*)?|tests?|fixtures?|local-ai|wheels|node_modules|\.agent-http-[^/]*|\.git)(?:$|\/)|\.(?:sqlite(?:-wal|-shm)?|gguf|bin|whl|docx?|wav|pcm)$/i.test(entry), `Private or development file in desktop package: ${entry}`);
    assert.ok(['desktop', 'dist', 'scripts', 'chrome-extension', 'server.mjs', 'package.json'].includes(entry.split('/')[0]), `Unexpected package root: ${entry}`);
  }
  const read = async relative => archived ? asar.extractFile(target, path.normalize(relative)) : readFile(path.join(target, relative));
  for (const directory of ['dist', 'desktop', 'chrome-extension', 'scripts']) {
    const sourceFiles = directory === 'scripts' ? nativeFiles : await walk(path.join(root, directory));
    const expected = sourceFiles.map(name => `${directory}/${name}`).sort();
    const actual = entries.filter(name => name.startsWith(`${directory}/`) && !entries.some(other => other.startsWith(`${name}/`))).sort();
    assert.deepEqual(actual, expected, `Unexpected or stale files in packaged ${directory}.`);
    for (const relative of expected) assert.deepEqual(await read(relative), await readFile(path.join(root, relative)), `Stale packaged file: ${relative}`);
  }
  if (archived) assert.deepEqual(await read('server.mjs'), await readFile(path.join(root, 'build/desktop-app/server.mjs')), 'Stale packaged backend.');
  for (const name of nativeFiles) assert.deepEqual(await read(`scripts/${name}`), await readFile(path.join(root, 'scripts', name)), `Missing or stale native module: ${name}`);
  const metadata = JSON.parse((await read('package.json')).toString());
  assert.equal(metadata.version, JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version);
  for (const required of ['server.mjs', 'dist/index.html', 'desktop/main.cjs', 'desktop/preload.cjs', 'chrome-extension/browser.js', 'chrome-extension/manifest.json']) assert.ok((await read(required)).length > 0, `Missing packaged file: ${required}`);
  console.log(`Desktop package contents verified (${metadata.version}).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await checkDesktopPackage(process.argv[2]);
