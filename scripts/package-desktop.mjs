import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, cp, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = await mkdtemp(path.join(os.tmpdir(), 'sameera-desktop-'));
const require = createRequire(import.meta.url);
const builderRoot = path.dirname(require.resolve('electron-builder/package.json'));
const args = [path.join(builderRoot, 'out', 'cli', 'cli.js'), '--config', path.join(root, 'electron-builder.yml'), '--win', process.argv.includes('--dir') ? '--dir' : 'nsis', `--config.directories.output=${output}`];
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true });
  child.on('error', reject);
  child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`Windows packaging failed (${code}).`)));
});
const release = path.join(root, 'release');
await mkdir(release, { recursive: true });
await cp(path.join(output, 'win-unpacked'), path.join(release, 'win-unpacked'), { recursive: true });
const { version } = JSON.parse(await readFile(path.join(root, 'build', 'desktop-app', 'package.json'), 'utf8'));
if (!process.argv.includes('--dir')) await cp(path.join(output, `Sameera-Setup-${version}.exe`), path.join(release, `Sameera-Setup-${version}.exe`));
await writeFile(path.join(root, 'build', 'installer-output-path.txt'), output);
console.log(`Windows application copied to ${release}`);
