import { Router } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createServer as createMcpServer } from '../../../../mcp/src/server.js';
import { getMcpRuntimeConfig, isMcpEnabled } from './config';
import { requireMcpAuth } from './auth';

interface ActiveMcpSession {
  transport: SSEServerTransport;
  createdAt: number;
  lastSeenAt: number;
  tokenFingerprint: string;
}

const router = Router();
const sessions = new Map<string, ActiveMcpSession>();

const cleanupInterval = setInterval(() => {
  void cleanupExpiredSessions();
}, 60_000);
cleanupInterval.unref();

router.get('/health', (_req, res) => {
  res.json({
    status: isMcpEnabled() ? 'ok' : 'disabled',
    transport: 'sse',
    activeSessions: sessions.size,
    timestamp: new Date().toISOString(),
  });
});

router.use(requireMcpAuth);

router.get('/sse', async (req, res) => {
  let sessionId: string | undefined;

  try {
    const runtimeConfig = getMcpRuntimeConfig();
    await cleanupExpiredSessions();

    if (sessions.size >= runtimeConfig.maxSessions) {
      res.status(503).json({
        success: false,
        error: {
          code: 'MCP_CAPACITY_REACHED',
          message:
            'Maximum number of active MCP sessions reached. Please retry later.',
        },
      });
      return;
    }

    const transport = new SSEServerTransport('/mcp/messages', res);
    const server = createMcpServer();
    sessionId = transport.sessionId;
    const now = Date.now();

    // Register the session before connect() emits the endpoint event.
    // Some clients POST immediately after receiving the endpoint, so
    // registering late can still create an MCP_SESSION_NOT_FOUND race.
    sessions.set(sessionId, {
      transport,
      createdAt: now,
      lastSeenAt: now,
      tokenFingerprint: req.mcpAuth!.tokenFingerprint,
    });

    transport.onclose = () => {
      const currentSessionId = sessionId;
      if (currentSessionId) {
        sessions.delete(currentSessionId);
      }
    };

    await server.connect(transport);
  } catch (error) {
    const currentSessionId = sessionId;
    if (currentSessionId) {
      sessions.delete(currentSessionId);
    }
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: {
          code: 'MCP_CONNECTION_FAILED',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to initialize MCP SSE session.',
        },
      });
    }
  }
});

router.post('/messages', async (req, res) => {
  try {
    const sessionId = req.query.sessionId?.toString();
    if (!sessionId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Missing required sessionId query parameter.',
        },
      });
      return;
    }

    const activeSession = sessions.get(sessionId);
    if (!activeSession) {
      res.status(404).json({
        success: false,
        error: {
          code: 'MCP_SESSION_NOT_FOUND',
          message: 'MCP session not found or already expired.',
        },
      });
      return;
    }

    if (
      activeSession.tokenFingerprint !== req.mcpAuth!.tokenFingerprint
    ) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'This MCP session belongs to a different token.',
        },
      });
      return;
    }

    activeSession.lastSeenAt = Date.now();
    await activeSession.transport.handlePostMessage(
      req,
      res,
      req.body
    );
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: {
          code: 'MCP_MESSAGE_FAILED',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to process MCP message.',
        },
      });
    }
  }
});

router.delete('/sessions/:sessionId', async (req, res) => {
  const session = sessions.get(req.params.sessionId);

  if (!session) {
    res.status(404).json({
      success: false,
      error: {
        code: 'MCP_SESSION_NOT_FOUND',
        message: 'MCP session not found.',
      },
    });
    return;
  }

  if (session.tokenFingerprint !== req.mcpAuth!.tokenFingerprint) {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'This MCP session belongs to a different token.',
      },
    });
    return;
  }

  sessions.delete(req.params.sessionId);
  await session.transport.close();

  res.json({ success: true });
});

async function cleanupExpiredSessions() {
  if (!isMcpEnabled()) {
    return;
  }

  const { sessionTtlMs } = getMcpRuntimeConfig();
  const now = Date.now();

  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastSeenAt <= sessionTtlMs) {
      continue;
    }

    sessions.delete(sessionId);
    await session.transport.close().catch(() => {
      /* ignore cleanup close errors */
    });
  }
}

export const mcpRouter = router;
