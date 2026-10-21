import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, getDefaultEnvironment } from '@modelcontextprotocol/sdk/client/stdio.js';
import Ajv from 'ajv';
import type { ValidateFunction } from 'ajv';
import type { ConnectionRepository } from '../database/ConnectionRepository.ts';
import { validateConfig } from './ConnectionConfig.ts';
import { httpTransport } from './HttpTransport.ts';
import type { CredentialStore } from './CredentialStore.ts';
import type { ConnectedTool } from './types.ts';

type Session = { id: string; client: Client; tools: ConnectedTool[]; validators: Map<string, ValidateFunction> };
export class ConnectionManager {
  private sessions = new Map<string, Session>();
  private connecting = new Set<string>();
  private errors = new Map<string, string>();
  private startingClients = new Set<Client>();
  private generation = 0;
  constructor(readonly repository: ConnectionRepository, private credentials: CredentialStore, private available = () => true) {}
  state() {
    return this.repository.list().map(connection => ({ ...connection, status: this.connecting.has(connection.id) ? 'connecting' : this.sessions.has(connection.id) ? 'connected' : 'disconnected', error: this.errors.get(connection.id), tools: this.tools(connection.id) }));
  }
  tools(id: string): ConnectedTool[] {
    const permissions = this.repository.permissions(id);
    return (this.sessions.get(id)?.tools || []).map(tool => ({ ...tool, enabled: permissions.get(tool.name) === true }));
  }
  async connect(id: string): Promise<void> {
    if (!this.available()) throw new Error('Connections are disabled in Local-only AI.');
    const generation = this.generation;
    if (this.connecting.has(id)) throw new Error('This connection is already starting.');
    this.connecting.add(id);
    this.errors.delete(id);
    let client: Client | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await this.disconnect(id);
      const row = this.repository.get(id), config = validateConfig(row.config);
      client = new Client({ name: 'Sameera', version: '1.0.0' });
      this.startingClients.add(client);
      const token = row.hasCredential ? await this.credentials.get(id) : undefined;
      if (row.hasCredential && !token) throw new Error('Saved token is missing. Re-enter it in Connections.');
      if (config.transport === 'stdio' && !(await fs.stat(config.command)).isFile()) throw new Error('Local executable not found.');
      if (!this.available() || generation !== this.generation) throw new Error('Connection was cancelled.');
      const transport = config.transport === 'http' ? httpTransport(config, token) : new StdioClientTransport({ command: config.command, args: config.args, env: getDefaultEnvironment(), stderr: 'ignore', maxBufferSize: 1024 * 1024 });
      const activeClient = client;
      await Promise.race([client.connect(transport), new Promise<never>((_, reject) => { timeout = setTimeout(() => { void activeClient.close(); reject(new Error('MCP connection timed out.')); }, 15000); })]);
      clearTimeout(timeout);
      const tools: ConnectedTool[] = [];
      const validators = new Map<string, ValidateFunction>();
      const ajv = new Ajv({ strictSchema: true, strictTypes: false, strictTuples: false, allErrors: false, validateFormats: false });
      let cursor: string | undefined;
      do {
        if (!this.available() || generation !== this.generation) throw new Error('Connection was cancelled.');
        const page = await client.listTools(cursor ? { cursor } : {}, { timeout: 15000 });
        for (const tool of page.tools) {
          if (tools.length >= 100 || JSON.stringify(tool.inputSchema).length > 20000) throw new Error('Server tool list is too large. Limit it to 100 tools with smaller schemas.');
          if (validators.has(tool.name)) throw new Error('Server advertised duplicate tool names.');
          validators.set(tool.name, ajv.compile(tool.inputSchema));
          tools.push({ name: tool.name, description: (tool.description || '').slice(0, 2000), inputSchema: tool.inputSchema, enabled: false });
        }
        cursor = page.nextCursor;
      } while (cursor);
      if (!this.available() || generation !== this.generation) throw new Error('Connection was cancelled.');
      this.sessions.set(id, { id: randomUUID(), client, tools, validators });
      client.onclose = () => { if (this.sessions.get(id)?.client === activeClient) this.sessions.delete(id); };
      client.onerror = () => this.errors.set(id, 'The server connection reported an error. Disconnect and reconnect before further actions.');
      this.repository.setEnabled(id, true);
    } catch (error) {
      await client?.close().catch(() => {});
      // Server error messages may contain request headers or tokens: do not expose them.
      const message = (error as any)?.code === 401 || (error as Error).name === 'UnauthorizedError' ? 'Authentication required. Enter a bearer token; OAuth sign-in is not available yet.' : 'Could not connect. Check the endpoint or executable, token, and server availability.';
      this.errors.set(id, message);
      throw new Error(message, { cause: error });
    } finally { clearTimeout(timeout); this.connecting.delete(id); if (client) this.startingClients.delete(client); }
  }
  async disconnect(id: string): Promise<void> {
    const session = this.sessions.get(id);
    this.sessions.delete(id);
    await session?.client.close().catch(() => {});
  }
  async close(): Promise<void> { this.generation++; await Promise.all([...this.sessions.keys()].map(id => this.disconnect(id)).concat([...this.startingClients].map(client => client.close().catch(() => {})))); }
  identity(id: string) { return this.sessions.get(id)?.id; }
  validate(id: string, name: string, args: Record<string, unknown>): Session {
    if (!this.available()) throw new Error('Connections are disabled in Local-only AI.');
    if (!this.repository.get(id).enabled) throw new Error('Connection is disabled.');
    const session = this.sessions.get(id);
    if (!session) throw new Error('Connect this server in Connections first.');
    if (this.repository.permissions(id).get(name) !== true) throw new Error('This tool is disabled. Enable it in Connections.');
    const validator = session.validators.get(name);
    if (!validator || !validator(args)) throw new Error('Arguments do not match the enabled tool schema.');
    return session;
  }
  async call(id: string, name: string, args: Record<string, unknown>) {
    const session = this.validate(id, name, args);
    return session.client.callTool({ name, arguments: args }, undefined, { timeout: 25000, maxTotalTimeout: 25000, resetTimeoutOnProgress: false });
  }
}
