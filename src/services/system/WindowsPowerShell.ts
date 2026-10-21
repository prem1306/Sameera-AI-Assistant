import path from 'node:path';

/** Never resolve the native credential/action host through PATH or the working directory. */
export function windowsPowerShell(env: Record<string, string | undefined> = process.env): string {
  const root = env.SystemRoot || env.WINDIR || 'C:\\Windows';
  if (!/^[a-z]:[\\/]/i.test(root) || /[\x00-\x1f]/.test(root)) throw new Error('Invalid Windows system directory.');
  return path.win32.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
}
