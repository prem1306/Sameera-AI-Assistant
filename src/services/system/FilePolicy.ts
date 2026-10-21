import path from 'node:path';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

/** Recheck the reviewed source after any wait in the shared execution queue. */
export async function verifyFileVersion(source: string, expectedHash: unknown) {
  if (expectedHash === undefined) return;
  if (typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/.test(expectedHash)) throw new Error('Invalid reviewed file version. Create and review a new task.');
  const actual = createHash('sha256').update(await fs.readFile(source)).digest('hex');
  if (actual !== expectedHash) throw new Error('The source changed after review. Create and review a new task before changing it.');
}

const executable = /\.(?:exe|com|bat|cmd|scr|pif|cpl|dll|sys|msi|msp|mst|msix|appx|lnk|url|scf|reg|hta|chm|ps1|psm1|psd1|vbs|vbe|wsf|wsh|js|jse|mjs|cjs|jsx|ts|tsx|py|pyw|rb|sh|bash|pl|php|html?|svg)$/i;

/** Text editing and ordinary file management must not create executable content. */
export function validateFileMutation(action: string, source: string, destination = source) {
  if (['writeText', 'replaceText'].includes(action) && !/\.(?:txt|md|csv|json|ya?ml)$/i.test(source)) {
    throw new Error('Text editing supports .txt, .md, .csv, .json and .yaml files. Choose a supported text filename.');
  }
  if (['copy', 'move', 'rename'].includes(action) && (executable.test(source) || executable.test(destination))) {
    throw new Error('Creating or relocating executable, script, installer or shortcut files is unavailable through file tools. Choose a document destination.');
  }
}

/** Check lexical aliases before path.resolve can erase them. */
export function validatePathSyntax(value: string) {
  if (/[\x00-\x1f<>"|?*]/.test(value)) throw new Error('Use a normal local path without control characters or device syntax.');
  if (process.platform === 'win32' && !/^[a-z]:[\\/]/i.test(value)) throw new Error('Specify a full local drive path.');
  const segments = value.slice(path.parse(value).root.length).split(/[\\/]/);
  if (segments.some(part => part === '.' || part === '..' || /[. ]$/.test(part) || /^(?:con|prn|aux|nul|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(part))) {
    throw new Error('Use an exact path without traversal, reserved Windows device names or trailing dots/spaces.');
  }
}
