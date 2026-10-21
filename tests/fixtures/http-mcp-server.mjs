import http from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createTestServer } from './mcp-server.mjs';
const server = http.createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const mcp = createTestServer();
  await mcp.connect(transport);
  response.on('close', () => { void mcp.close(); });
  await transport.handleRequest(request, response, body);
});
server.listen(Number(process.env.TEST_MCP_PORT || 3003), '127.0.0.1', () => console.log('Test MCP server ready on localhost'));
