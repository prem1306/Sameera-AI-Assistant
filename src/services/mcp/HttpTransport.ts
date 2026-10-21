import http from 'node:http';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { Readable } from 'node:stream';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { isPublicAddress } from '../PublicWeb.ts';
import type { ConnectionConfig } from './types.ts';

export function httpTransport(config: Extract<ConnectionConfig, { transport: 'http' }>, token?: string) {
  const endpoint = new URL(config.url);
  const safeFetch = (async (input: any, init: RequestInit = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (url.origin !== endpoint.origin || url.pathname !== endpoint.pathname || url.search) throw new Error('MCP request changed its configured endpoint.');
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const addresses = await lookup(host, { all: true });
    const local = config.allowLocalhost && ['localhost', '127.0.0.1', '::1'].includes(host);
    if (!addresses.length || addresses.some(row => !(isPublicAddress(row.address) || (local && ['127.0.0.1', '::1'].includes(row.address))))) throw new Error('MCP endpoint resolved to an unsupported private address.');
    const selected = addresses[0];
    return new Promise<Response>((resolve, reject) => {
      const request = (url.protocol === 'https:' ? https : http).request(url, {
        method: init.method || 'GET', headers: Object.fromEntries(new Headers(init.headers).entries()), signal: init.signal || undefined,
        lookup: ((_host: string, options: { all?: boolean }, callback: Function) => options.all ? callback(null, [selected]) : callback(null, selected.address, selected.family)) as any,
      }, response => {
        if ((response.statusCode || 0) >= 300 && (response.statusCode || 0) < 400) { response.resume(); reject(new Error('MCP redirects are not followed. Use the final server endpoint.')); return; }
        const headers = new Headers();
        for (const [key, value] of Object.entries(response.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        const status = response.statusCode || 500;
        resolve(new Response([204, 205, 304].includes(status) ? null : Readable.toWeb(response) as ReadableStream, { status, headers }));
      });
      request.on('error', reject);
      request.setTimeout(35000, () => request.destroy(new Error('MCP request timed out.')));
      if (init.body !== undefined && init.body !== null && typeof init.body !== 'string') { request.destroy(); reject(new Error('Unsupported MCP request body.')); return; }
      request.end(init.body || undefined);
    });
  }) as typeof fetch;
  return new StreamableHTTPClientTransport(endpoint, { fetch: safeFetch, requestInit: token ? { headers: { Authorization: `Bearer ${token}` } } : {}, reconnectionOptions: { maxRetries: 0, maxReconnectionDelay: 1000, initialReconnectionDelay: 1000, reconnectionDelayGrowFactor: 1 } });
}
