import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { LocalDatabase } from '../database/LocalDatabase.ts';
import { ConnectionManager } from './ConnectionManager.ts';
import { CredentialStore } from './CredentialStore.ts';
import { ToolExecutor } from './ToolExecutor.ts';
import { validateConfig } from './ConnectionConfig.ts';
import { parsePlugin } from '../plugins/PluginManifest.ts';

export class McpService {
  readonly connections: ConnectionManager;
  readonly executor: ToolExecutor;
  private credentials: CredentialStore;
  constructor(private database: LocalDatabase, available = () => true) {
    this.credentials = new CredentialStore(path.join(path.dirname(database.filePath), 'connection-credentials'));
    this.connections = new ConnectionManager(database.connections, this.credentials, available);
    this.executor = new ToolExecutor(this.connections);
  }
  state() { return { connections: this.connections.state(), plugins: this.database.connections.presets(), pending: this.executor.pending(), history: this.database.connections.history() }; }
  catalog() {
    return this.connections.state().filter(row => row.enabled && row.status === 'connected').map(row => ({ id: row.id, name: row.name, tools: row.tools.filter(tool => tool.enabled) }));
  }
  async action(operation: string, args: any) {
    const repository = this.database.connections;
    if (operation === 'add') return repository.add(args.name, validateConfig(args.config));
    if (operation === 'importPlugin') {
      const manifest = parsePlugin(args.manifest);
      repository.savePreset(randomUUID(), manifest.name, manifest);
      return { message: 'Plugin preset imported. Review its server details before adding a connection.' };
    }
    if (operation === 'removePlugin') { repository.removePreset(args.id); return {}; }
    if (operation === 'addPluginConnection') {
      const preset = repository.presets().find(row => row.id === args.id);
      if (!preset) throw new Error('Plugin preset not found.');
      const manifest = parsePlugin(preset.manifest);
      return repository.add(manifest.name, manifest.connection);
    }
    if (this.connections.state().find(row => row.id === args.id)?.status === 'connecting') throw new Error('Wait for this connection to finish starting.');
    if (operation === 'connect') { await this.connections.connect(args.id); return {}; }
    if (operation === 'disconnect') { await this.connections.disconnect(args.id); return {}; }
    if (operation === 'disable') { repository.setEnabled(args.id, false); await this.connections.disconnect(args.id); return {}; }
    if (operation === 'remove') {
      repository.setEnabled(args.id, false);
      await this.connections.disconnect(args.id);
      await this.credentials.remove(args.id);
      repository.remove(args.id);
      return {};
    }
    if (operation === 'token') {
      const row = repository.get(args.id);
      if (row.config.transport !== 'http') throw new Error('Bearer tokens are only used by remote HTTP connections.');
      await this.connections.disconnect(args.id);
      if (args.token === '') { await this.credentials.remove(args.id); repository.setCredential(args.id, false); }
      else { await this.credentials.set(args.id, args.token); repository.setCredential(args.id, true); }
      return {};
    }
    if (operation === 'permission') {
      if (typeof args.enabled !== 'boolean' || !this.connections.tools(args.id).some(tool => tool.name === args.tool)) throw new Error('Choose a discovered tool.');
      repository.setPermission(args.id, args.tool, args.enabled);
      return {};
    }
    if (operation === 'request') return this.executor.request(args.callId, args.connectionId, args.toolName, args.arguments);
    if (operation === 'approve') return this.executor.approve(args.id);
    if (operation === 'cancel') return this.executor.cancel(args.id);
    throw new Error('Unsupported connection action.');
  }
}
