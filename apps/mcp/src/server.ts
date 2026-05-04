/**
 * MCP Server Factory
 *
 * Creates and configures the MCP server with all tools.
 * Shared between SSE and stdio transports.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getAllTools } from './tools/index.js';
import type { ToolSpec, TextContent } from './types.js';

/**
 * Create a configured MCP server instance.
 */
export function createServer(): Server {
  const tools = getAllTools();
  const toolMap = new Map<string, ToolSpec>();

  for (const tool of tools) {
    if (toolMap.has(tool.name)) {
      throw new Error(`Duplicate tool name: ${tool.name}`);
    }
    toolMap.set(tool.name, tool);
  }

  const server = new Server(
    { name: 'sync-erp-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  // List all tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;
    const tool = toolMap.get(name);

    if (!tool) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` } satisfies TextContent],
        isError: true,
      };
    }

    const args = (rawArgs ?? {}) as Record<string, unknown>;

    try {
      const result = await tool.handler(args);
      return {
        content: [{ type: 'text', text: result } satisfies TextContent],
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `Error: ${message}` } satisfies TextContent],
        isError: true,
      };
    }
  });

  return server;
}
