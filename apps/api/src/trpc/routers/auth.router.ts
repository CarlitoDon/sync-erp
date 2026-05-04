import {
  router,
  publicProcedure,
  authenticatedProcedure,
  publicRateLimit,
} from '../trpc';
import { container, ServiceKeys } from '../../modules/common/di';
import { TRPCError } from '@trpc/server';
import type { CookieOptions } from 'express';
import {
  registerSchema,
  loginSchema,
  resendVerificationSchema,
  verifyEmailSchema,
} from '@sync-erp/shared';
import { z } from 'zod';
import { AuthService } from '../../modules/auth/auth.service';
import type { Context } from '../context';

const authService = container.resolve<AuthService>(
  ServiceKeys.AUTH_SERVICE
);

function getCookieOptions(): CookieOptions {
  const isSecureEnv =
    process.env.SECURE_COOKIES === 'true' ||
    process.env.NODE_ENV === 'production' ||
    process.env.NODE_ENV === 'staging';

  return {
    httpOnly: true,
    secure: isSecureEnv,
    sameSite: isSecureEnv ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function getAuthAuditContext(ctx: Context) {
  const forwardedFor = ctx.req.headers['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor;
  const forwardedIp = forwardedValue?.split(',')[0]?.trim();

  return {
    correlationId:
      ctx.req.headers['x-correlation-id']?.toString() ||
      ctx.req.headers['x-request-id']?.toString(),
    ipAddress:
      forwardedIp ||
      ctx.req.ip ||
      ctx.req.socket.remoteAddress ||
      undefined,
    userAgent: ctx.req.headers['user-agent']?.toString(),
  };
}

export const authRouter = router({
  /**
   * Register new user
   */
  register: publicProcedure
    .use(
      publicRateLimit({
        namespace: 'auth.register',
        maxAttempts: 5,
        windowMs: 15 * 60 * 1000,
      })
    )
    .input(registerSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await authService.register(
        input,
        getAuthAuditContext(ctx)
      );

      if (!result.success) {
        throw new TRPCError({
          /* eslint-disable @sync-erp/no-hardcoded-enum -- tRPC error codes, not database enum */
          code:
            result.error!.code === 'CONFLICT'
              ? 'CONFLICT'
              : result.error!.code === 'EMAIL_DELIVERY_FAILED'
                ? 'INTERNAL_SERVER_ERROR'
                : 'BAD_REQUEST',
          /* eslint-enable @sync-erp/no-hardcoded-enum */
          message: result.error!.message,
        });
      }

      return {
        user: result.user!,
        verificationRequired: result.verificationRequired ?? false,
        verificationSentTo: result.verificationSentTo!,
        verificationUrl: result.verificationUrl,
      };
    }),

  /**
   * Login user
   */
  login: publicProcedure
    .use(
      publicRateLimit({
        namespace: 'auth.login',
        maxAttempts: 10,
        windowMs: 15 * 60 * 1000,
      })
    )
    .input(loginSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await authService.login(
        input,
        getAuthAuditContext(ctx)
      );

      if (!result.success) {
        throw new TRPCError({
          code:
            result.error!.code === 'PRECONDITION_FAILED'
              ? 'PRECONDITION_FAILED'
              : 'UNAUTHORIZED',
          message: result.error!.message,
        });
      }
      ctx.res.cookie('sessionId', result.session!.id, getCookieOptions());

      return {
        user: result.user!,
        session: result.session!,
      };
    }),

  resendVerification: publicProcedure
    .use(
      publicRateLimit({
        namespace: 'auth.resendVerification',
        maxAttempts: 5,
        windowMs: 15 * 60 * 1000,
      })
    )
    .input(resendVerificationSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await authService.resendVerification(
        input.email,
        getAuthAuditContext(ctx)
      );

      if (!result.success) {
        throw new TRPCError({
          code:
            result.error!.code === 'EMAIL_DELIVERY_FAILED'
              ? 'INTERNAL_SERVER_ERROR'
              : 'BAD_REQUEST',
          message: result.error!.message,
        });
      }

      return {
        success: true,
        verificationSentTo: result.verificationSentTo!,
        verificationUrl: result.verificationUrl,
      };
    }),

  verifyEmail: publicProcedure
    .use(
      publicRateLimit({
        namespace: 'auth.verifyEmail',
        maxAttempts: 10,
        windowMs: 15 * 60 * 1000,
      })
    )
    .input(verifyEmailSchema)
    .mutation(async ({ input, ctx }) => {
      const result = await authService.verifyEmail(
        input.token,
        getAuthAuditContext(ctx)
      );

      if (!result.success) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: result.error!.message,
        });
      }

      ctx.res.cookie('sessionId', result.session!.id, getCookieOptions());

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
