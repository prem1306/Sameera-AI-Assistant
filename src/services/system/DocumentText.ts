import { inflateRawSync } from 'node:zlib';
import * as cheerio from 'cheerio';
export function zipCrc(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
export function docxText(data: Buffer): { text: string; warnings: string[] } {
  let end = -1;
  for (let at = data.length - 22; at >= Math.max(0, data.length - 65557); at--) if (data.readUInt32LE(at) === 0x06054b50) { end = at; break; }
  if (end < 0) throw new Error('Invalid or encrypted DOCX.');
  const entries = data.readUInt16LE(end + 10), offset = data.readUInt32LE(end + 16);
  if (entries > 2000 || data.readUInt16LE(end + 4) !== 0 || data.readUInt16LE(end + 6) !== 0) throw new Error('Unsupported archive.');
  const parts = new Map<string, string>(); const warnings = new Set<string>();
  let cursor = offset, expanded = 0;
  for (let i = 0; i < entries; i++) {
    if (cursor + 46 > data.length || data.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Corrupt document archive.');
    const flags = data.readUInt16LE(cursor + 8), method = data.readUInt16LE(cursor + 10), compressed = data.readUInt32LE(cursor + 20), size = data.readUInt32LE(cursor + 24);
    const nameLength = data.readUInt16LE(cursor + 28), extraLength = data.readUInt16LE(cursor + 30), commentLength = data.readUInt16LE(cursor + 32), local = data.readUInt32LE(cursor + 42);
    const name = data.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    cursor += 46 + nameLength + extraLength + commentLength;
    if (flags & 1 || cursor > data.length) throw new Error('Encrypted or corrupt archive.');
    if (/^word\/(media|embeddings)\//.test(name)) warnings.add('Images or embedded objects require visual comparison.');
    if (!/^word\/(document|header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/.test(name)) continue;
    if (parts.has(name) || size > 8000000 || (expanded += size) > 16000000 || local + 30 > data.length || data.readUInt32LE(local) !== 0x04034b50) throw new Error('Document extraction limit or malformed archive.');
    const start = local + 30 + data.readUInt16LE(local + 26) + data.readUInt16LE(local + 28);
    const localName = data.subarray(local + 30, local + 30 + data.readUInt16LE(local + 26)).toString('utf8');
    if (localName !== name || data.readUInt16LE(local + 8) !== method || data.readUInt16LE(local + 6) !== flags) throw new Error('Document part metadata does not match.');
    if (start + compressed > data.length || ![0, 8].includes(method)) throw new Error('Unsupported compression.');
    const bytes = method === 8 ? inflateRawSync(data.subarray(start, start + compressed), { maxOutputLength: Math.max(1, size) }) : data.subarray(start, start + compressed);
    if (bytes.length !== size || zipCrc(bytes) !== data.readUInt32LE(cursor - 46 - nameLength - extraLength - commentLength + 16)) throw new Error('Corrupt document part.');
    const xml = bytes.toString('utf8');
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Document contains prohibited XML declarations.');
    if (/<w:(ins|del|moveFrom|moveTo)\b/.test(xml)) warnings.add('Tracked changes require manual review.');
    if (/comments/.test(name)) warnings.add('Document contains comments.');
    const $ = cheerio.load(xml, { xmlMode: true });
    const text = $('w\\:p').map((_, p) => $(p).find('w\\:t, w\\:delText, w\\:tab, w\\:br').map((_, n) => ['w:tab', 'w:br'].includes(n.tagName) ? ' ' : $(n).text()).get().join('')).get().join('\n');
    parts.set(name, text);
  }
  if (!parts.has('word/document.xml')) throw new Error('DOCX body missing.');
  return { text: [...parts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, text]) => `${name}\n${text}`).join('\n').normalize('NFC').replace(/\s+/gu, ' ').trim(), warnings: [...warnings] };
}
