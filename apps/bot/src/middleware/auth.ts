import type { Request, Response, NextFunction } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { parseBearerToken } from '../utils/auth';

function matchesBotSecret(token: string | null): boolean {
  const expectedSecret = process.env.SYNC_ERP_BOT_SECRET;

  if (!token || !expectedSecret) {
    return false;
  }

  const tokenDigest = createHash('sha256')
    .update(token, 'utf8')
    .digest();
  const expectedDigest = createHash('sha256')
    .update(expectedSecret, 'utf8')
    .digest();

  return timingSafeEqual(tokenDigest, expectedDigest);
}

export const authenticateApiKey = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res
      .status(401)
      .json({ error: 'Missing Authorization header' });
  }

  const token = parseBearerToken(authHeader);

  if (!matchesBotSecret(token)) {
    return res.status(403).json({ error: 'Invalid API Key' });
  }

  next();
};
