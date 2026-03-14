import type { Request, Response, NextFunction } from 'express';
import { parseBearerToken } from '../utils/auth';

const BOT_SECRET = process.env.SYNC_ERP_BOT_SECRET;

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

  if (!token || token !== BOT_SECRET) {
    return res.status(403).json({ error: 'Invalid API Key' });
  }

  next();
};
