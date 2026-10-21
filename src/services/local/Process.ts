import { spawn, type ChildProcess } from 'node:child_process';
export const privateEnvironment = () => ({ SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, TEMP: process.env.TEMP, TMP: process.env.TMP, PATH: process.env.PATH, HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1', HF_HUB_DISABLE_TELEMETRY: '1', DO_NOT_TRACK: '1', PYTHONUTF8: '1', OLLAMA_NO_CLOUD: '1' });
export function runProcess(executable: string, args: string[], input: string, signal: AbortSignal, timeout = 180000, environment = privateEnvironment()): Promise<string> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child: ChildProcess = spawn(executable, args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: environment });
    let output = '', settled = false;
    const finish = (error?: Error) => { if (settled) return; settled = true; clearTimeout(timer); signal.removeEventListener('abort', abort); error ? reject(error) : resolve(output); };
    const abort = () => { child.kill(); finish(new Error('Local operation cancelled.')); };
    const timer = setTimeout(() => { child.kill(); finish(new Error('Local operation timed out.')); }, timeout);
    signal.addEventListener('abort', abort, { once: true });
    child.stdout!.on('data', data => { output += data; if (output.length > 8 * 1024 * 1024) { child.kill(); finish(new Error('Local output exceeds limit.')); } });
    child.stderr!.resume();
    child.on('error', () => finish(new Error('Local runtime could not start.')));
    child.on('close', code => finish(code === 0 ? undefined : new Error('Local runtime failed.')));
    child.stdin!.on('error', () => {}); child.stdin!.end(input);
  });
}
