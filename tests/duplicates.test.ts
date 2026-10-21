import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { docxText, zipCrc } from '../src/services/system/DocumentText.ts';
import { DuplicateService } from '../src/services/system/DuplicateService.ts';

function zip(parts: Record<string, string>) {
  const local: Buffer[] = [], central: Buffer[] = []; let offset = 0;
  for (const [name, content] of Object.entries(parts)) {
    const filename = Buffer.from(name), bytes = Buffer.from(content), crc = zipCrc(bytes), header = Buffer.alloc(30), record = Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt32LE(crc, 14); header.writeUInt32LE(bytes.length, 18); header.writeUInt32LE(bytes.length, 22); header.writeUInt16LE(filename.length, 26);
    record.writeUInt32LE(0x02014b50); record.writeUInt16LE(20, 4); record.writeUInt16LE(20, 6); record.writeUInt32LE(crc, 16); record.writeUInt32LE(bytes.length, 20); record.writeUInt32LE(bytes.length, 24); record.writeUInt16LE(filename.length, 28); record.writeUInt32LE(offset, 42);
    local.push(header, filename, bytes); central.push(record, filename); offset += header.length + filename.length + bytes.length;
  }
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(parts).length, 8); end.writeUInt16LE(Object.keys(parts).length, 10); end.writeUInt32LE(Buffer.concat(central).length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}
const document = (text: string, extra = '') => `<w:document xmlns:w="urn:word"><w:body><w:p>${extra}<w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`;
async function fixture(run: (folder: string) => Promise<void>) {
  const folder = await fs.mkdtemp(path.join(process.cwd(), '.duplicate-fixture-'));
  try { await run(folder); } finally { assert.equal(path.dirname(folder), process.cwd()); await fs.rm(folder, { recursive: true, force: true }); }
}

test('DOCX preserves Unicode, text order, punctuation and case; checks CRC, XML and bounded parts', () => {
  const a = zip({ 'word/document.xml': document('తెలుగు Tamil e\u0301 42!') });
  assert.match(docxText(a).text, /తెలుగు Tamil é 42!/);
  const corrupt = Buffer.from(a); corrupt[65] ^= 1; assert.throws(() => docxText(corrupt));
  assert.throws(() => docxText(zip({ 'word/document.xml': '<!DOCTYPE x><w:p />' })), /XML/);
  assert.throws(() => docxText(Buffer.from('broken')), /DOCX/);
  const warnings = docxText(zip({ 'word/document.xml': document('Same text', '<w:ins/>'), 'word/media/image1.png': 'image', 'word/comments.xml': '<w:p><w:r><w:t>Comment</w:t></w:r></w:p>' })).warnings;
  assert.equal(warnings.length, 3);
});

test('duplicate reports distinguish identical bytes from matching text and skip corrupt/locked documents', async () => fixture(async folder => {
  const first = zip({ 'word/document.xml': document('తెలుగు 42!') }), second = zip({ 'word/document.xml': document('తెలుగు 42!', '<w:pPr/>'), 'word/media/image.png': 'different image' });
  for (const [name, bytes] of Object.entries({ 'a.docx': first, 'b.docx': first, 'c.docx': second, 'corrupt.docx': Buffer.from('corrupt'), 'locked.doc': Buffer.from('legacy') })) await fs.writeFile(path.join(folder, name), bytes);
  const service = new DuplicateService(async () => ({ success: false })); const progress: number[] = [];
  const result = await service.execute({ capability: 'duplicates', action: 'scan', args: { folder } }, new AbortController().signal, done => progress.push(done));
  assert.ok('report' in result);
  assert.equal(result.groupCount, 1); assert.equal(result.extraCopies, 2); assert.equal(result.report.groups[0].basis, 'matching-text'); assert.equal(result.report.skipped.length, 2); assert.equal(progress.at(-1), 5);
  const all = result.report.groups[0].files.map((row: any) => row.path);
  await assert.rejects(service.fingerprint({ capability: 'duplicates', action: 'recycle', args: { reportId: result.report.id, paths: all } }), /Keep/);
  const step = { capability: 'duplicates', action: 'recycle', args: { reportId: result.report.id, paths: [all[1]] } };
  await service.fingerprint(step); await fs.appendFile(all[0], 'changed'); await assert.rejects(service.fingerprint(step), /changed/);
}));

test('recycling only selects approved extras, rechecks keeper and returns a partial receipt on cancellation', async () => fixture(async folder => {
  const files = ['a', 'b', 'c'].map(name => path.join(folder, `${name}.docx`));
  for (const file of files) await fs.writeFile(file, zip({ 'word/document.xml': document('Keep one copy') }));
  const controller = new AbortController(); let calls = 0;
  const service = new DuplicateService(async (action, args) => { assert.equal(action, 'recycle'); assert.equal(args.path, files[1]); assert.equal(args.keepers[0].path, files[0]); assert.equal(args.expectedHash.length, 64); calls++; await fs.unlink(args.path); controller.abort(); return { success: true }; });
  const scan = await service.execute({ capability: 'duplicates', action: 'scan', args: { paths: files } }, new AbortController().signal);
  assert.ok('report' in scan);
  assert.equal(scan.report.groups[0].basis, 'identical-file');
  const result = await service.execute({ capability: 'duplicates', action: 'recycle', args: { reportId: scan.report.id, paths: files.slice(1) } }, controller.signal);
  assert.ok('receipt' in result);
  assert.equal(calls, 1); assert.equal(result.cancelled, true); assert.equal(result.receipt.recycledCount, 1); assert.ok(await fs.stat(files[0])); assert.ok(await fs.stat(files[2]));
  await assert.rejects(service.fingerprint({ capability: 'duplicates', action: 'recycle', args: { reportId: scan.report.id, paths: [files[2]] } }), /expired/);
}));
