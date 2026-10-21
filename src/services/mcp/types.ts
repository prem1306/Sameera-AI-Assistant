export type ConnectionConfig = { transport: 'http'; url: string; allowLocalhost: boolean } | { transport: 'stdio'; command: string; args: string[] };
export type Connection = { id: string; name: string; config: ConnectionConfig; enabled: boolean; hasCredential: boolean };
export type ConnectedTool = { name: string; description: string; inputSchema: Record<string, unknown>; enabled: boolean };
export type ToolResult = { success: boolean; [key: string]: unknown };
export type ToolRequest = { id: string; connectionId: string; toolName: string; arguments: Record<string, unknown>; state: 'pending' | 'running' | 'done' | 'cancelled'; expires: number; result?: ToolResult };
