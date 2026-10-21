import { windowsPowerShell } from './WindowsPowerShell.ts';
import { validatePathSyntax } from './FilePolicy.ts';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export type Args = Record<string, any>;
export type SystemResult = { success: boolean; needsClarification?: boolean; question?: string; [key: string]: any };
export const ask = (question: string): SystemResult => ({ success: false, needsClarification: true, question, instruction: 'Ask the user this question and WAIT. Do not guess or execute further dependent actions.' });
export const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const script = process.env.SAMEERA_NATIVE_ROOT || process.env.SAMEERA_APP_ROOT ? path.join(process.env.SAMEERA_NATIVE_ROOT || process.env.SAMEERA_APP_ROOT!, 'scripts', 'windows-actions.ps1') : fileURLToPath(new URL('../../../scripts/windows-actions.ps1', import.meta.url));

export async function checkedPath(value: unknown): Promise<string> {
  if (typeof value !== 'string' || !path.isAbsolute(value) || value.startsWith('\\\\')) throw new Error('Specify the exact absolute local path, including drive and filename.');
  validatePathSyntax(value);
  const target = path.resolve(value);
  const segments = target.toLowerCase().split(/[\\/]/);
  if (segments.some((part) => /[. ]$/.test(part)) || target.slice(path.parse(target).root.length).includes(':')) throw new Error('Use an exact normal filename without trailing dots/spaces or alternate data streams.');
  if (segments.some((part) => /^\.env(?:\..*)?$/.test(part) || ['.ssh', '.aws', '.codex', '.agents', '.git', 'appdata', 'credentials', 'secrets'].includes(part)) || /\.(pem|key|pfx|p12)$/i.test(target)) throw new Error('Credential files, application data, and assistant configuration directories cannot be accessed by voice tools.');
  for (const root of [process.env.WINDIR, process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.ProgramData].filter(Boolean) as string[]) {
    if (target.toLowerCase() === root.toLowerCase() || target.toLowerCase().startsWith(root.toLowerCase() + path.sep)) throw new Error('Windows and installed-program folders are protected. Choose a personal file or folder.');
  }
  // Disallow junction/symlink traversal for both existing files and new destinations.
  let cursor = target;
  while (cursor !== path.dirname(cursor)) {
    try {
      if ((await fs.lstat(cursor)).isSymbolicLink()) throw new Error('This path contains a link or junction. Specify the real target path before proceeding.');
      const canonical = await fs.realpath(cursor);
      if (canonical.toLowerCase() !== cursor.toLowerCase()) throw new Error('This path uses an alias. Please specify its full real path before proceeding.');
    }
    catch (error: any) { if (error.code !== 'ENOENT') throw error; }
    cursor = path.dirname(cursor);
  }
  return target;
}

export async function windowsAction(action: string, args: Args): Promise<SystemResult> {
  if (process.platform !== 'win32') return ask('These controls need Windows. Which supported action would you like instead?');
  return new Promise((resolve) => {
    const child = spawn(windowsPowerShell(), ['-NoProfile', '-NonInteractive', '-STA', '-File', script], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    let error = '';
    const timer = setTimeout(() => { child.kill(); resolve({ ...ask('The Windows action timed out. Please check whether a dialog is open before retrying.'), uncertain: true }); }, 25000);
    child.stdout.on('data', (data) => { output += data.toString(); if (output.length > 2000000) { child.kill(); resolve({ ...ask('The native result exceeded its limit. Inspect the application before retrying.'), uncertain: true }); } });
    child.stderr.on('data', (data) => { if (error.length < 2000) error += data.toString(); });
    child.on('error', () => { clearTimeout(timer); resolve(ask('The Windows control service could not start. Please check the local server.')); });
    child.on('close', () => {
      clearTimeout(timer);
      try { resolve(JSON.parse(output.replace(/^\uFEFF/, '').trim())); }
      catch { resolve(ask(error.trim().slice(0, 500) || 'The action did not return a verifiable result. Check the application before retrying.')); }
    });
    // User paths and text are JSON data on stdin, never interpolated into shell code.
    child.stdin.end(JSON.stringify({ ...args, action }));
  });
}


export type NativeAction = (action: string, args: Args) => Promise<SystemResult>;
