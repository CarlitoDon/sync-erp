import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { registerSchema, loginSchema } from '@sync-erp/shared';

export class AuthController {
  private service = new AuthService();

  private setSessionCookie(res: Response, sessionId: string) {
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax',
    });
  }

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = registerSchema.parse(req.body);
      const result = await this.service.register(payload);

      if (!result.success) {
        // Map error codes
        const status = result.error?.code === 'CONFLICT' ? 409 : 400;
        return res.status(status).json(result);
      }

      const { user, session } = result;
      this.setSessionCookie(res, session!.id);

      res.status(201).json({
        success: true,
        data: user, // Legacy consistent: return user object directly in data
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = loginSchema.parse(req.body);
      const result = await this.service.login(payload);

      if (!result.success) {
        return res.status(401).json(result);
      }

      const { user, session } = result;
      this.setSessionCookie(res, session!.id);

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.cookies['sessionId'];
      if (sessionId) {
        await this.service.logout(sessionId);
      }
      res.clearCookie('sessionId');
      res.json({ success: true, message: 'Logged out' });
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.cookies['sessionId'];
      if (!sessionId) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
        });
      }

      const session = await this.service.getSession(sessionId);
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
  };
}
