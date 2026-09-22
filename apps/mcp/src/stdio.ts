/**
 * MCP Stdio Server Entry Point
 *
 * Exposes the MCP server over stdio transport (for CLI/desktop clients).
 */
import './env.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

const server = createServer();
const transport = new StdioServerTransport();
await server.connect(transport);
