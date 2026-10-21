import path from 'node:path';
import { isIP } from 'node:net';
import { isPublicAddress } from '../PublicWeb.ts';
import type { ConnectionConfig } from './types.ts';

export function validateConfig(input: any): ConnectionConfig {
  if (input?.transport === 'http') {
    if (typeof input.url !== 'string' || input.url.length > 2048) throw new Error('Enter an MCP URL under 2048 characters.');
    const url = new URL(input.url);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.hash || url.search) throw new Error('Use an MCP URL without embedded credentials, query parameters, or fragments.');
    if (!(url.protocol === 'https:' || (local && url.protocol === 'http:' && input.allowLocalhost === true))) throw new Error('Use HTTPS, or explicitly allow a localhost HTTP server.');
    if (local && input.allowLocalhost !== true) throw new Error('Allow localhost explicitly for this connection.');
    const address = url.hostname.replace(/^\[|\]$/g, '');
    if (!local && (url.hostname.endsWith('.local') || (isIP(address) && !isPublicAddress(address)))) throw new Error('Private network endpoints are not supported.');
    return { transport: 'http', url: url.href, allowLocalhost: local && input.allowLocalhost === true };
  }
  if (input?.transport === 'stdio') {
    if (typeof input.command !== 'string' || input.command.length > 1024 || !path.isAbsolute(input.command) || /[\x00-\x1f]/.test(input.command)) throw new Error('Choose the absolute executable path for your local MCP server.');
    if (!Array.isArray(input.args) || input.args.length > 40 || input.args.some((arg: unknown) => typeof arg !== 'string' || arg.length > 2000 || /[\x00-\x1f]/.test(arg))) throw new Error('Arguments must be a JSON array of up to 40 plain strings.');
    if (/^(cmd|powershell|pwsh|bash|sh)(\.exe)?$/i.test(path.basename(input.command))) throw new Error('Select the server executable or runtime directly, rather than a command shell.');
    return { transport: 'stdio', command: input.command, args: input.args };
  }
  throw new Error('Choose a remote or local MCP connection.');
}

export function connectionName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 100 || /[\x00-\x1f]/.test(value)) throw new Error('Enter a connection name up to 100 characters.');
  return value.trim();
}
