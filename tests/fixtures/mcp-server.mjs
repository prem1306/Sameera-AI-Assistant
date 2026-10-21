import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

export function createTestServer(onCall = () => {}) {
  const server = new Server({ name: 'Sameera test server', version: '1.0.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: [{ name: 'echo', description: 'Echo a message for Sameera connection testing.', inputSchema: { type: 'object', properties: { message: { type: 'string', maxLength: 200 } }, required: ['message'], additionalProperties: false } }] }));
  server.setRequestHandler(CallToolRequestSchema, request => {
    onCall();
    if (request.params.arguments?.message === 'fail') return { isError: true, content: [{ type: 'text', text: 'Deliberate test failure' }] };
    return { content: [{ type: 'text', text: `Echo: ${request.params.arguments?.message}` }] };
  });
  return server;
}
if (process.argv.includes('--stdio')) await createTestServer().connect(new StdioServerTransport());
