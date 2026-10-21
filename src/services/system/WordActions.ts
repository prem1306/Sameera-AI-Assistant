import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ask, checkedPath, type Args, type NativeAction, type SystemResult } from './ActionSupport.ts';

export const isWordAction = (action: string) => ['wordDraft', 'wordOpen', 'wordRead', 'wordReplace', 'wordAppend', 'wordSave'].includes(action);

export async function performWordAction(action: string, args: Args, nativeAction: NativeAction, draftFolder: string): Promise<SystemResult> {
  if (action === 'wordDraft') {
    if (typeof args.text !== 'string' || !args.text.trim()) return ask('What would you like me to write in the new Word document?');
    if (args.text.length > 60000 || args.text.includes('\0')) return ask('Please provide document text under 60,000 characters without binary data.');
    const minimumWords = args.minimumWords ?? 0;
    if (!Number.isSafeInteger(minimumWords) || minimumWords < 0 || minimumWords > 10000) return ask('What minimum word count should the document meet?');
    const text = args.text.replace(/\r\n?|\n/g, '\n').trim();
    const wordCount = text.split(/\s+/u).length;
    if (wordCount < minimumWords) return { success: false, error: `The draft has ${wordCount} words; compose at least ${minimumWords} words before calling wordDraft again.`, requiresMoreText: true };
    await checkedPath(draftFolder);
    await fs.mkdir(draftFolder, { recursive: true });
    const folder = await checkedPath(path.join(draftFolder, `word-${randomUUID()}`));
    await fs.mkdir(folder);
    const draftPath = await checkedPath(path.join(folder, 'draft.docx'));
    const result = await nativeAction('wordDraft', { path: draftPath, text });
    if (!result.success) return { ...result, path: draftPath };
    const saved = await fs.stat(draftPath).catch(() => null);
    if (!result.verified || !saved?.isFile() || saved.size === 0) return ask('The new Word draft could not be verified. Please inspect Word before retrying.');
    return { ...result, path: draftPath, draft: true, wordCount, text,
      message: `Created and displayed a new Word working draft with ${wordCount} words.`,
      instruction: 'The requested text is in a separate working draft in Word. Do not repeat this creation. Ask for the desired filename and destination only if the user wants a permanent copy; use copy with the returned draft path.' };
  }
  if (!args.path) return ask('Which exact file or folder path should I use? If you only know its name, tell me which folder to search.');
  const target = await checkedPath(args.path);
  if (!(await fs.stat(target).catch(() => null))) return ask('That path does not exist. Please give the correct path or tell me where to search.');
  if (['wordOpen', 'wordRead', 'wordReplace', 'wordAppend', 'wordSave'].includes(action)) {
    if (!/\.docx?$/i.test(target)) return ask('Please choose a .doc or .docx Word document.');
    if (action === 'wordReplace' && (typeof args.find !== 'string' || !args.find || typeof args.replacement !== 'string')) return ask('Which exact text should I replace, and what should replace it?');
    if (action === 'wordAppend' && typeof args.text !== 'string') return ask('What exact text should I append to the document?');
    return nativeAction(action, { ...args, path: target });
  }
  return ask('That Word action is not supported.');
}
