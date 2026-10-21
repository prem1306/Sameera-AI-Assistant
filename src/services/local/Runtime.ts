import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { LocalInstaller } from './Installer.ts';
import { runProcess, privateEnvironment } from './Process.ts';
import { AGENT_INSTRUCTION, RESEARCH_NOTES_INSTRUCTION } from '../agent/ModelTools.ts';
import { languageInstruction, PERSONAS, type Language, type Persona } from '../session/Preferences.ts';

/** Owns portable workers. No provider SDK, registry pulls or cloud fallback. */
export class LocalRuntime {
  readonly installer: LocalInstaller;
  private ollama?: ChildProcess;
  private endpoint = '';
  private modelReady = false;
  private queue: Promise<unknown> = Promise.resolve();
  private active = new Set<AbortController>();
  readonly timings: Record<string, number> = {};
  constructor(readonly root: string, private scripts: string) { this.installer = new LocalInstaller(root, scripts); }
  async status() { return { ...await this.installer.status(), timings: { ...this.timings }, busy: this.active.size > 0 }; }
  stop() { for (const controller of this.active) controller.abort(); this.ollama?.kill(); this.ollama = undefined; this.endpoint = ''; this.modelReady = false; }
  async exclusive<T>(operation: (signal: AbortSignal) => Promise<T>, caller?: AbortSignal): Promise<T> {
    const controller = new AbortController(); this.active.add(controller);
    const signal = caller ? AbortSignal.any([caller, controller.signal]) : controller.signal;
    const work = this.queue.catch(() => {}).then(async () => { signal.throwIfAborted(); if (!(await this.installer.status()).ready) throw new Error('Install the offline package in Agent settings first.'); return operation(signal); });
    this.queue = work;
    try { return await work; } finally { this.active.delete(controller); }
  }
  async transcribe(pcm: Buffer, signal: AbortSignal) {
    if (pcm.length > 1920000 || pcm.length < 1600 || pcm.length % 2) throw new Error('Use a short spoken request, up to one minute.');
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'sameera-speech-'));
    const started = performance.now();
    try {
      const header = Buffer.alloc(44); header.write('RIFF'); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(16000, 24); header.writeUInt32LE(32000, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
      const wav = path.join(temporary, 'input.wav'); await fs.writeFile(wav, Buffer.concat([header, pcm]));
      const executable = await this.find(path.join(this.root, 'whisper'), 'whisper-cli.exe');
      await runProcess(executable, ['-m', path.join(this.root, 'ggml-small.bin'), '-f', wav, '-l', 'auto', '-t', '4', '-nt', '-oj', '-of', path.join(temporary, 'result')], '', signal);
      const result = JSON.parse(await fs.readFile(path.join(temporary, 'result.json'), 'utf8'));
      return (result.transcription || []).map((row: any) => row.text || '').join(' ').trim().slice(0, 4000);
    } finally { this.timings.recognitionMs = Math.round(performance.now() - started); await fs.rm(temporary, { recursive: true, force: true }); }
  }
  async reason(text: string, language: Language, persona: Persona, signal: AbortSignal) {
    if (!text.trim() || text.length > 8000) throw new Error('Enter a request up to 8,000 characters.');
    await this.ensureOllama(signal);
    const started = performance.now();
    try {
      const response = await fetch(`${this.endpoint}/api/chat`, { method: 'POST', signal: AbortSignal.any([signal, AbortSignal.timeout(180000)]), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'sameera-local', stream: false, think: false, keep_alive: 0, format: 'json', options: { num_ctx: 4096, num_predict: 700, num_thread: 4 }, messages: [{ role: 'system', content: `${PERSONAS[persona].instruction} ${languageInstruction(language)} ${AGENT_INSTRUCTION} ${RESEARCH_NOTES_INSTRUCTION} Return ONLY JSON {"reply":"spoken response", "steps":[]}. steps is an array of typed task proposals, never executions. Leave steps empty for conversation. No tools can grant their own approval. /no_think` }, { role: 'user', content: text }] }) });
      if (!response.ok) throw new Error('Local planner failed.');
      const result = await response.json();
      const parsed = JSON.parse(String(result.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim());
      if (typeof parsed.reply !== 'string' || !Array.isArray(parsed.steps) || parsed.steps.length > 20) throw new Error('Local planner returned an invalid proposal.');
      return { reply: parsed.reply.slice(0, 1500), steps: parsed.steps };
    } finally {
      // keep_alive=0 unloads after completion; explicitly unload on interruption too.
      const unloaded = await fetch(`${this.endpoint}/api/generate`, { method: 'POST', signal: AbortSignal.timeout(3000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'sameera-local', keep_alive: 0 }) }).then(response => response.ok).catch(() => false);
      if (!unloaded) this.stop();
      this.timings.reasoningMs = Math.round(performance.now() - started);
    }
  }
  async speak(text: string, language: Language, persona: Persona, signal: AbortSignal) {
    if (!text.trim() || text.length > 1500) throw new Error('Local speech is limited to 1,500 characters per chunk.');
    const started = performance.now();
    try { return JSON.parse(await runProcess(path.join(this.root, 'python/python.exe'), [path.join(this.scripts, 'local-speech.py')], JSON.stringify({ root: this.root, text, language, persona }), signal, 300000)); }
    finally { this.timings.synthesisMs = Math.round(performance.now() - started); }
  }
  private async find(root: string, filename: string, depth = 0): Promise<string> {
    if (depth > 3) throw new Error('Local runtime executable is missing. Reinstall the offline package.');
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) if (entry.isFile() && entry.name === filename) return path.join(root, entry.name);
    for (const entry of entries) if (entry.isDirectory()) { const found = await this.find(path.join(root, entry.name), filename, depth + 1).catch(() => ''); if (found) return found; }
    throw new Error('Local runtime executable is missing. Reinstall the offline package.');
  }
  private async ensureOllama(signal: AbortSignal) {
    if (!this.ollama) {
      const port = await new Promise<number>((resolve, reject) => { const server = net.createServer(); server.on('error', reject); server.listen(0, '127.0.0.1', () => { const port = (server.address() as net.AddressInfo).port; server.close(() => resolve(port)); }); });
      this.endpoint = `http://127.0.0.1:${port}`;
      const executable = await this.find(path.join(this.root, 'ollama'), 'ollama.exe');
      this.ollama = spawn(executable, ['serve'], { windowsHide: true, stdio: 'ignore', env: { ...privateEnvironment(), OLLAMA_HOST: `127.0.0.1:${port}`, OLLAMA_MODELS: path.join(this.root, 'ollama-models'), OLLAMA_MAX_LOADED_MODELS: '1', OLLAMA_NUM_PARALLEL: '1', OLLAMA_ORIGINS: 'http://127.0.0.1', OLLAMA_CONTEXT_LENGTH: '4096' } });
      const worker = this.ollama;
      worker.on('error', () => { if (this.ollama === worker) this.ollama = undefined; });
      worker.on('exit', () => { if (this.ollama === worker) { this.ollama = undefined; this.modelReady = false; } });
      let ready = false;
      for (let attempt = 0; attempt < 60; attempt++) { signal.throwIfAborted(); if (await fetch(`${this.endpoint}/api/version`, { signal: AbortSignal.timeout(500) }).then(r => r.ok).catch(() => false)) { ready = true; break; } await new Promise(resolve => setTimeout(resolve, 250)); }
      if (!ready) { this.stop(); throw new Error('Portable local planner did not start.'); }
    }
    if (!this.modelReady) {
      const modelfile = path.join(this.root, `Modelfile-${randomUUID()}`);
      await fs.writeFile(modelfile, `FROM ${JSON.stringify(path.join(this.root, 'qwen3.gguf').replaceAll('\\', '/'))}\nTEMPLATE """${await fs.readFile(path.join(this.root, 'qwen-template.txt'), 'utf8')}"""\nPARAMETER num_ctx 4096\n`);
      try {
        const executable = await this.find(path.join(this.root, 'ollama'), 'ollama.exe');
        await runProcess(executable, ['create', 'sameera-local', '-f', modelfile], '', signal, 180000, { ...privateEnvironment(), OLLAMA_HOST: this.endpoint } as any);
        this.modelReady = true;
      } finally { await fs.rm(modelfile, { force: true }); }
    }
  }
}
