/**
<<<<<<< HEAD
 * MCP StreamableHTTP Server Entry Point
 *
 * Exposes the MCP server over StreamableHTTP transport (MCP spec 2025-03-26).
 * Replaces the legacy SSE transport for multi-session support.
 */
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { createServer } from './server.js';
import { randomUUID } from 'node:crypto';
import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { getHttpRuntimeConfig, isHttpMcpEnabled } from './config.js';
=======
 * MCP SSE Server Entry Point
 *
 * Exposes the MCP server over Server-Sent Events (SSE) transport.
 */
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import { createServer } from './server.js';
>>>>>>> origin/dev

const app = express();
app.use(express.json());

<<<<<<< HEAD
interface ActiveMcpSession {
  transport: StreamableHTTPServerTransport;
  createdAt: number;
  lastSeenAt: number;
  tokenFingerprint: string;
}

const transports = new Map<string, ActiveMcpSession>();

const cleanupInterval = setInterval(() => {
  void cleanupExpiredSessions();
}, 60_000);
cleanupInterval.unref();

app.get('/health', (_req, res) => {
  try {
    const runtimeConfig = getHttpRuntimeConfig();
    res.json({
      status: isHttpMcpEnabled() ? 'ok' : 'disabled',
      service: 'sync-erp-mcp',
      version: '1.0.0',
      transport: 'streamable-http',
      activeSessions: transports.size,
      maxSessions: runtimeConfig.maxSessions,
      sessionTtlMs: runtimeConfig.sessionTtlMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      service: 'sync-erp-mcp',
      error:
        error instanceof Error
          ? error.message
          : 'Invalid MCP HTTP runtime config.',
    });
  }
});

app.post('/mcp', async (req, res) => {
  const tokenFingerprint = authenticateRequest(req, res);
  if (!tokenFingerprint) {
    return;
  }

  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && transports.has(sessionId)) {
    const session = transports.get(sessionId)!;
    if (!assertSessionOwner(session, tokenFingerprint, res)) {
      return;
    }

    session.lastSeenAt = Date.now();
    await session.transport.handleRequest(req, res, req.body);
    return;
  }

  if (sessionId && !transports.has(sessionId)) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const runtimeConfig = getHttpRuntimeConfig();
  await cleanupExpiredSessions();

  if (transports.size >= runtimeConfig.maxSessions) {
    res.status(503).json({
      error: 'Maximum number of active MCP sessions reached.',
    });
    return;
  }

  let initializedSessionId: string | undefined;
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => {
      initializedSessionId = id;
      const now = Date.now();
      transports.set(id, {
        transport,
        createdAt: now,
        lastSeenAt: now,
        tokenFingerprint,
      });
      console.log(`New MCP session: ${id}`);
    },
    onsessionclosed: (id) => {
      if (transports.delete(id)) {
        console.log(`MCP session closed: ${id}`);
      }
    },
  });

  transport.onclose = () => {
    const sid =
      initializedSessionId ??
      [...transports.entries()].find(
        ([, session]) => session.transport === transport
      )?.[0];
    if (sid && transports.delete(sid)) {
      console.log(`MCP session closed: ${sid}`);
    }
  };

  const server = createServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get('/mcp', async (req, res) => {
  const tokenFingerprint = authenticateRequest(req, res);
  if (!tokenFingerprint) {
    return;
  }

  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).json({ error: 'Invalid or missing session ID' });
    return;
  }

  const session = transports.get(sessionId)!;
  if (!assertSessionOwner(session, tokenFingerprint, res)) {
    return;
  }

  session.lastSeenAt = Date.now();
  await session.transport.handleRequest(req, res);
});

app.delete('/mcp', async (req, res) => {
  const tokenFingerprint = authenticateRequest(req, res);
  if (!tokenFingerprint) {
    return;
  }

  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports.has(sessionId)) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const session = transports.get(sessionId)!;
  if (!assertSessionOwner(session, tokenFingerprint, res)) {
    return;
  }

  await session.transport.handleRequest(req, res);
  transports.delete(sessionId);
});

function authenticateRequest(req: Request, res: Response): string | null {
  let runtimeConfig;
  try {
    runtimeConfig = getHttpRuntimeConfig();
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'Invalid MCP HTTP runtime config.',
    });
    return null;
  }

  if (runtimeConfig.bearerTokens.length === 0) {
    res.status(503).json({
      error:
        'MCP HTTP transport is disabled. Configure SYNC_ERP_MCP_BEARER_TOKEN to enable it.',
    });
    return null;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Missing or invalid Authorization header. Expected Bearer token.',
    });
    return null;
  }

  const providedToken = authHeader.slice('Bearer '.length).trim();
  const isValid = runtimeConfig.bearerTokens.some((expectedToken) =>
    safeEqual(providedToken, expectedToken)
  );

  if (!isValid) {
    res.status(401).json({ error: 'Invalid MCP bearer token.' });
    return null;
  }

  return tokenFingerprint(providedToken);
}

function assertSessionOwner(
  session: ActiveMcpSession,
  tokenFingerprintValue: string,
  res: Response
): boolean {
  if (session.tokenFingerprint === tokenFingerprintValue) {
    return true;
  }

  res.status(403).json({
    error: 'This MCP session belongs to a different bearer token.',
  });
  return false;
}

function tokenFingerprint(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

async function cleanupExpiredSessions() {
  const { sessionTtlMs } = getHttpRuntimeConfig();
  const now = Date.now();

  for (const [sessionId, session] of transports.entries()) {
    if (now - session.lastSeenAt <= sessionTtlMs) {
      continue;
    }

    transports.delete(sessionId);
    await session.transport.close().catch(() => {
      /* ignore cleanup close errors */
    });
  }
}

const PORT = Number(process.env.MCP_PORT ?? 3005);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sync ERP MCP Server listening on port ${PORT}`);
  console.log(`StreamableHTTP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`Health check: http://localhost:${PORT}/health`);
=======
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
>>>>>>> origin/dev
});
