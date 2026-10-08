import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';

// Article URLs come from visitors. Never allow them to reach the host's private network.
export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    // Accept global unicast only; exclude documentation and transition networks.
    return /^[23][0-9a-f]{3}:/.test(lower) && !/^2001:(?:0*:|db8:|0*2:|0*10:|0*20:)/.test(lower) && !lower.startsWith('2002:');
  }
  return false;
}

export async function fetchPublicPage(input: string, redirects = 0): Promise<{ ok: boolean; status: number; statusText: string; headers: Headers; url: string; text: () => Promise<string> }> {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port))) throw new Error('Choose a public HTTP or HTTPS webpage.');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw new Error('Only public internet webpages can be read.');
  const selected = addresses[0];
  const result = await new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).get(url, {
      // Pin the validated DNS result for this connection, including redirects.
      lookup: ((_host: string, options: { all?: boolean }, callback: Function) => options.all ? callback(null, [selected]) : callback(null, selected.address, selected.family)) as any,
      headers: { 'User-Agent': 'Sameera-ArticleReader/1.1', Accept: 'text/html,application/xhtml+xml', 'Accept-Encoding': 'identity' },
    }, (response) => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 2 * 1024 * 1024) request.destroy(new Error('Webpage is too large to read.'));
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode || 500, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    const timeout = setTimeout(() => request.destroy(new Error('Webpage request timed out.')), 12000);
    request.on('close', () => clearTimeout(timeout));
    request.on('error', reject);
  });
  if ([301, 302, 303, 307, 308].includes(result.status) && result.headers.location) {
    if (redirects >= 5) throw new Error('Webpage redirected too many times.');
    return fetchPublicPage(new URL(result.headers.location, url).href, redirects + 1);
  }
  const headers = new Headers();
  for (const [name, value] of Object.entries(result.headers)) if (value) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  return { ok: result.status >= 200 && result.status < 300, status: result.status, statusText: http.STATUS_CODES[result.status] || '', headers, url: url.href, text: async () => result.body.toString('utf8') };
}
