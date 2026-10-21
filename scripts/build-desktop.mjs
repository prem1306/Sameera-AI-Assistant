import { build } from 'esbuild';
import { cp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'build', 'desktop-app');
const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
// This is generated output. Remove stale bundles and files before preparing a release.
const buildRoot = path.join(root, 'build');
await mkdir(buildRoot, { recursive: true });
if (await realpath(buildRoot) !== path.join(await realpath(root), 'build') || path.dirname(output) !== buildRoot) throw new Error('Desktop output must stay inside the project build directory.');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await build({
  absWorkingDir: root, entryPoints: ['server.ts'], outfile: path.join(output, 'server.mjs'),
  platform: 'node', target: 'node22', format: 'esm', bundle: true,
  external: ['vite', 'bufferutil', 'utf-8-validate'],
  banner: { js: "import { createRequire as createNodeRequire } from 'node:module'; const require = createNodeRequire(import.meta.url);" },
});
for (const directory of ['dist', 'desktop', 'chrome-extension']) await cp(path.join(root, directory), path.join(output, directory), { recursive: true });
await mkdir(path.join(output, 'scripts'), { recursive: true });
await cp(path.join(root, 'scripts', 'windows-actions.ps1'), path.join(output, 'scripts', 'windows-actions.ps1'));
await cp(path.join(root, 'scripts', 'windows-apps.ps1'), path.join(output, 'scripts', 'windows-apps.ps1'));
await cp(path.join(root, 'scripts', 'windows-word.ps1'), path.join(output, 'scripts', 'windows-word.ps1'));
await cp(path.join(root, 'scripts', 'windows-notepad.ps1'), path.join(output, 'scripts', 'windows-notepad.ps1'));
await cp(path.join(root, 'scripts', 'windows-credentials.ps1'), path.join(output, 'scripts', 'windows-credentials.ps1'));
await cp(path.join(root, 'scripts', 'WindowsAudio.cs'), path.join(output, 'scripts', 'WindowsAudio.cs'));
await writeFile(path.join(output, 'package.json'), JSON.stringify({ name: 'sameera-desktop', productName: 'Sameera', version: metadata.version, description: 'Sameera voice assistant for Windows', author: 'Sameera', main: 'desktop/main.cjs', private: true }, null, 2));
console.log('Desktop application prepared in build/desktop-app (no .env or API keys included).');

await cp(path.join(root, 'scripts', 'windows-word-inspect.ps1'), path.join(output, 'scripts', 'windows-word-inspect.ps1'));

for (const file of ['expand-local-package.ps1', 'local-speech.py']) await cp(path.join(root, 'scripts', file), path.join(output, 'scripts', file));
