import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { getMcpRuntimeConfig, isMcpEnabled } from './config';

declare module 'express-serve-static-core' {
  interface Request {
    mcpAuth?: {
      tokenFingerprint: string;
    };
  }
}

export function requireMcpAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!isMcpEnabled()) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'MCP_DISABLED',
        message: 'MCP is not enabled on this server.',
      },
    });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message:
          'Missing or invalid Authorization header. Expected Bearer token.',
      },
    });
  }

  const providedToken = authHeader.slice('Bearer '.length).trim();
  const runtimeConfig = getMcpRuntimeConfig();

  const isValid = runtimeConfig.bearerTokens.some((expectedToken) =>
    safeEqual(providedToken, expectedToken)
  );

  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid MCP bearer token.',
      },
    });
  }

  req.mcpAuth = {
    tokenFingerprint: crypto
      .createHash('sha256')
      .update(providedToken)
      .digest('hex'),
  };

  next();
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(left),
    Buffer.from(right)
  );
}
