import { validateConfig, connectionName } from '../mcp/ConnectionConfig.ts';
import type { ConnectionConfig } from '../mcp/types.ts';

export type PluginManifest = { version: 1; name: string; description: string; connection: ConnectionConfig };
export function parsePlugin(value: any): PluginManifest {
  if (value?.version !== 1) throw new Error('Plugin preset version must be 1.');
  if (typeof value.description !== 'string' || value.description.length > 500) throw new Error('Plugin description must be text up to 500 characters.');
  return { version: 1, name: connectionName(value.name), description: value.description, connection: validateConfig(value.connection) };
}
