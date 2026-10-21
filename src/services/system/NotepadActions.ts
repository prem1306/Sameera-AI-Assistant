import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ask, checkedPath, hash, type Args, type NativeAction, type SystemResult } from './ActionSupport.ts';

export async function createNotepadDraft(args: Args, nativeAction: NativeAction, draftFolder: string): Promise<SystemResult> {
  if (typeof args.text !== 'string' || !args.text.trim()) return ask('What would you like me to write in Notepad?');
  if (args.text.length > 60000 || args.text.includes('\0')) return ask('Please specify a note under 60,000 characters without binary data.');
  // A dedicated draft is safer than typing into whichever editor happens to have focus.
  // No user-named document is overwritten or saved without a destination instruction.
  const folder = draftFolder;
  await checkedPath(folder);
  await fs.mkdir(folder, { recursive: true });
  const draftPath = await checkedPath(path.join(folder, `note-${randomUUID()}.txt`));
  const text = args.text.replace(/\r\n?|\n/g, '\r\n');
  const bytes = Buffer.from('\uFEFF' + text, 'utf8');
  await fs.writeFile(draftPath, bytes, { flag: 'wx' });
  if (!(await fs.readFile(draftPath)).equals(bytes)) return ask('The note could not be verified. Please check the draft before proceeding.');
  const opened = await nativeAction('notepadOpen', { path: draftPath });
  return { ...opened, path: draftPath, text, verified: true, version: hash(bytes), draft: true,
    message: opened.success ? 'Created a separate UTF-8 draft, verified its exact text, and opened it in Notepad.' : opened.question,
    instruction: 'This is a separate working draft, not saved to a user-chosen destination. Read back the wording if requested. Ask for a destination before making a permanent copy. Verification checks text delivery, not whether speech was understood correctly.' };

}
