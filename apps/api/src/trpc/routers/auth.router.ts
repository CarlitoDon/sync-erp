import {
  router,
  publicProcedure,
  authenticatedProcedure,
} from '../trpc';
import { container, ServiceKeys } from '../../modules/common/di';
import { TRPCError } from '@trpc/server';
import { registerSchema, loginSchema } from '@sync-erp/shared';
import { z } from 'zod';
import { AuthService } from '../../modules/auth/auth.service';

const authService = container.resolve<AuthService>(
  ServiceKeys.AUTH_SERVICE
);

export const authRouter = router({
  /**
   * Register new user
   */
  register: publicProcedure
    .input(registerSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await authService.register(input);

      if (!result.success) {
        throw new TRPCError({
          /* eslint-disable @sync-erp/no-hardcoded-enum -- tRPC error codes, not database enum */
          code:
            result.error!.code === 'CONFLICT'
              ? 'CONFLICT'
              : 'BAD_REQUEST',
          /* eslint-enable @sync-erp/no-hardcoded-enum */
          message: result.error!.message,
        });
      }

      // Set session cookie
      // Use SECURE_COOKIES env var as primary check (dotenv-loaded vars available)
      // Falls back to NODE_ENV for backwards compatibility
      const isSecureEnv =
        process.env.SECURE_COOKIES === 'true' ||
        process.env.NODE_ENV === 'production' ||
        process.env.NODE_ENV === 'staging';
      ctx.res.cookie('sessionId', result.session!.id, {
        httpOnly: true,
        secure: isSecureEnv,
        sameSite: isSecureEnv ? 'none' : 'lax', // 'none' required for cross-site (Vercel -> Hostinger)
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return {
        user: result.user!,
        session: result.session!,
      };
    }),

  /**
   * Login user
   */
  login: publicProcedure
    .input(loginSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await authService.login(input);

      if (!result.success) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: result.error!.message,
        });
      }

      // Set session cookie
      // Use SECURE_COOKIES env var as primary check (dotenv-loaded vars available)
      // Falls back to NODE_ENV for backwards compatibility
      const isSecureEnv =
        process.env.SECURE_COOKIES === 'true' ||
        process.env.NODE_ENV === 'production' ||
        process.env.NODE_ENV === 'staging';
      ctx.res.cookie('sessionId', result.session!.id, {
        httpOnly: true,
        secure: isSecureEnv,
        sameSite: isSecureEnv ? 'none' : 'lax', // 'none' required for cross-site (Vercel -> Hostinger)
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return {
        user: result.user!,
        session: result.session!,
      };
    }),

  /**
   * Logout user
   */
  logout: authenticatedProcedure.mutation(async ({ ctx }) => {
    // Get sessionId from cookie (parsed by optionalAuthMiddleware)
    const sessionId = ctx.req.cookies['sessionId'];
    if (sessionId) {
      await authService.logout(sessionId);
    }
    // Clear session cookie
    ctx.res.clearCookie('sessionId');
    return { success: true };
  }),

  /**
   * Get session
   */
  getSession: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      return authService.getSession(input.sessionId);
    }),

  /**
   * Get current user (me)
   */
  me: authenticatedProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) return null;
    return authService.getProfile(ctx.userId);
  }),
});

export type AuthRouter = typeof authRouter;
