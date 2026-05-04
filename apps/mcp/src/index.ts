/**
 * MCP SSE Server Entry Point
 *
 * Exposes the MCP server over Server-Sent Events (SSE) transport.
 */
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import { createServer } from './server.js';

const app = express();
app.use(express.json());

const server = createServer();
let transport: SSEServerTransport | null = null;

app.get('/sse', async (_req, res) => {
  console.log('New SSE connection established');
  transport = new SSEServerTransport('/messages', res);
  await server.connect(transport);
});

app.post('/messages', async (req, res) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send('No active SSE transport');
  }
});

const PORT = Number(process.env.MCP_PORT ?? 3005);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sync ERP MCP SSE Server listening on port ${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
});
