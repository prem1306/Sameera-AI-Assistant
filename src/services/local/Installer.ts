import { windowsPowerShell } from '../system/WindowsPowerShell.ts';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import assets from './Assets.json';
import dependencies from './Dependencies.json';
import { runProcess } from './Process.ts';

type Asset = { name: string; url: string; sha256?: string; gitBlob?: string; gated?: boolean; kind?: string };
export class LocalInstaller {
  private controller?: AbortController;
  private progress = { state: 'not-installed', stage: '', bytes: 0, error: '' };
  constructor(readonly root: string, private scripts: string) {}
  async status() { const ready = await fs.readFile(path.join(this.root, 'ready.json'), 'utf8').then(s => JSON.parse(s).version === assets.version).catch(() => false); return { ...this.progress, ready, version: assets.version, approximateDownloadGB: 11, minimumFreeGB: 24 }; }
  cancel() { this.controller?.abort(); }
  async install(token = '') {
    if (this.controller) throw new Error('A local installation is already running.');
    if (token && !/^hf_[A-Za-z0-9]{10,200}$/.test(token)) throw new Error('Enter a valid Hugging Face read token.');
    const controller = this.controller = new AbortController();
    const signal = controller.signal;
    this.progress = { state: 'installing', stage: 'Checking disk space', bytes: 0, error: '' };
    try {
      await fs.mkdir(this.root, { recursive: true });
      const disk = await fs.statfs(this.root); if (disk.bavail * disk.bsize < 24 * 1024 ** 3) throw new Error('Keep at least 24 GB free for the offline package.');
      await fs.rm(path.join(this.root, 'ready.json'), { force: true });
      // Check gated access before beginning large public downloads.
      await this.download(assets.files.find(file => 'gated' in file && file.gated)!, token, signal);
      for (const file of assets.files) await this.download(file, token, signal);
      for (const file of dependencies) await this.download({ ...file, name: `wheels/${file.filename}` }, '', signal);
      this.progress.stage = 'Unpacking verified runtimes';
      for (const kind of ['python', 'whisper', 'ollama', 'pip']) {
        const file = assets.files.find(file => file.kind === kind)!;
        await runProcess(windowsPowerShell(), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(this.scripts, 'expand-local-package.ps1')], JSON.stringify({ root: this.root, zip: path.join(this.root, file.name), destination: path.join(this.root, kind === 'pip' ? 'python/Lib/site-packages' : kind) }), signal);
      }
      await fs.writeFile(path.join(this.root, 'python/python311._pth'), 'python311.zip\n.\nLib/site-packages\nimport site\n');
      const python = path.join(this.root, 'python/python.exe');
      this.progress.stage = 'Installing verified Python dependencies offline';
      // Bootstrap build tools before installing the pinned source distributions.
      for (const name of ['setuptools', 'wheel']) {
        const file = dependencies.find(row => row.name === name)!;
        await runProcess(python, ['-m', 'pip', 'install', '--no-index', '--no-deps', path.join(this.root, 'wheels', file.filename)], '', signal);
      }
      const requirements = dependencies.map(file => `${file.name}==${file.version} --hash=sha256:${file.sha256}`).join('\n');
      await fs.writeFile(path.join(this.root, 'requirements.txt'), requirements);
      await runProcess(python, ['-m', 'pip', 'install', '--no-index', '--find-links', path.join(this.root, 'wheels'), '--require-hashes', '--no-build-isolation', '-r', path.join(this.root, 'requirements.txt'), '--disable-pip-version-check'], '', signal, 600000);
      await runProcess(python, ['-c', 'import torch, transformers, parler_tts, soundfile; print("ready")'], '', signal);
      await fs.writeFile(path.join(this.root, 'ready.json'), JSON.stringify({ version: assets.version }));
      this.progress.state = 'installed'; this.progress.stage = 'Offline package ready';
    } catch (error) {
      this.progress.state = signal.aborted ? 'cancelled' : 'failed';
      this.progress.error = error instanceof Error ? error.message : 'Local installation failed.';
    } finally { token = ''; this.controller = undefined; }
  }
  private async download(file: Asset, token: string, signal: AbortSignal) {
    signal.throwIfAborted();
    const target = path.resolve(this.root, file.name);
    if (!target.startsWith(path.resolve(this.root) + path.sep)) throw new Error('Invalid asset path.');
    const verify = async (filename: string) => {
      const hash = createHash(file.sha256 ? 'sha256' : 'sha1');
      const stat = await fs.stat(filename);
      if (!file.sha256) hash.update(`blob ${stat.size}\0`);
      for await (const chunk of createReadStream(filename)) hash.update(chunk);
      return hash.digest('hex') === (file.sha256 || file.gitBlob);
    };
    this.progress.stage = `Downloading ${file.name}`;
    if (await verify(target).catch(() => false)) return;
    const url = new URL(file.url);
    if (url.protocol !== 'https:' || !['github.com', 'www.python.org', 'files.pythonhosted.org', 'huggingface.co', 'registry.ollama.ai'].includes(url.hostname)) throw new Error('Unapproved model download source.');
    await fs.mkdir(path.dirname(target), { recursive: true });
    const partial = target + '.partial';
    try {
      const response = await fetch(url, { headers: file.gated && token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.any([signal, AbortSignal.timeout(1800000)]) });
      if (!response.ok || !response.body) throw new Error(file.gated && [401, 403].includes(response.status) ? 'Indic Parler requires Hugging Face access approval and a read token. The token is not saved.' : `Download failed for ${file.name}. Retry installation.`);
      let bytes = 0;
      const stream = Readable.fromWeb(response.body as any);
      stream.on('data', chunk => { bytes += chunk.length; this.progress.bytes += chunk.length; if (bytes > 5 * 1024 ** 3) stream.destroy(new Error('Asset exceeds download limit.')); });
      await pipeline(stream, createWriteStream(partial), { signal });
      if (!await verify(partial)) throw new Error(`Verification failed for ${file.name}.`);
      await fs.rename(partial, target);
    } finally { await fs.rm(partial, { force: true }).catch(() => {}); }
  }
}
