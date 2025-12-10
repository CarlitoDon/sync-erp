import { Router, Response } from 'express';
import { z } from 'zod';
import { registerSchema, loginSchema } from '@sync-erp/shared';
import { register, login } from '../services/authService.js';
import { deleteSession, getSession } from '../services/sessionService.js';

const router = Router();

// Helper to set cookie
const setSessionCookie = (res: Response, sessionId: string) => {
  res.cookie('sessionId', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax',
  });
};

router.post('/register', async (req, res, next) => {
  try {
    const payload = registerSchema.parse(req.body);
    const result = await register(payload);

    if (!result.success || !result.user || !result.session) {
      const status = result.error?.code === 'CONFLICT' ? 409 : 400;
      return res.status(status).json({
        success: false,
        error: result.error || { code: 'UNKNOWN_ERROR', message: 'Registration failed' },
      });
    }

    setSessionCookie(res, result.session.id);

    res.status(201).json({
      success: true,
      data: result.user,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.errors,
        },
      });
    }
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);
    const result = await login(payload);

    if (!result.success || !result.user || !result.session) {
      return res.status(401).json({
        success: false,
        error: result.error || { code: 'UNAUTHORIZED', message: 'Authentication failed' },
      });
    }

    setSessionCookie(res, result.session.id);

    res.json({
      success: true,
      data: result.user,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: error.errors,
        },
      });
    }
    next(error);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const sessionId = req.cookies['sessionId'];
    if (sessionId) {
      await deleteSession(sessionId);
    }
    res.clearCookie('sessionId');
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/me', async (req, res, next) => {
  try {
    // Check local session manually since this route might be public in app.ts
    const sessionId = req.cookies['sessionId'];
    if (!sessionId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });
    }

    const session = await getSession(sessionId);
    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Session expired' },
      });
    }

    res.json({
      success: true,
      data: session.user,
    });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };
