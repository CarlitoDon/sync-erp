import { router, publicProcedure } from '../trpc';
import { AuthService } from '../../modules/auth/auth.service';
import { registerSchema, loginSchema } from '@sync-erp/shared';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

const authService = new AuthService();

export const authRouter = router({
  /**
   * Register new user
   */
  register: publicProcedure
    .input(registerSchema)
    .mutation(async ({ input }) => {
      const result = await authService.register(input);

      if (!result.success) {
        throw new TRPCError({
          code:
            result.error!.code === 'CONFLICT'
              ? 'CONFLICT'
              : 'BAD_REQUEST',
          message: result.error!.message,
        });
      }

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
    .mutation(async ({ input }) => {
      const result = await authService.login(input);

      if (!result.success) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: result.error!.message,
        });
      }

      return {
        user: result.user!,
        session: result.session!,
      };
    }),

  /**
   * Logout user
   */
  logout: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input }) => {
      await authService.logout(input.sessionId);
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
});

export type AuthRouter = typeof authRouter;
