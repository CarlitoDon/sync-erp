import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from './context';
import superjson from 'superjson';
import { BusinessShape } from '@sync-erp/database';

const t = initTRPC.context<Context>().create({
  transformer: superjson, // For Date serialization
});

/**
 * Base router and procedure helpers
 */
export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Authenticated procedure - requires userId only (no company required)
 * Use for auth endpoints like /me that don't need company context
 */
export const authenticatedProcedure = t.procedure.use(
  async ({ ctx, next }) => {
    if (!ctx.userId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
      });
    }

    return next({
      ctx: {
        ...ctx,
        userId: ctx.userId,
      },
    });
  }
);

/**
 * Protected procedure - requires authentication AND company context
 */
export const protectedProcedure = t.procedure.use(
  async ({ ctx, next }) => {
    if (!ctx.userId || !ctx.companyId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated or company not selected',
      });
    }

    return next({
      ctx: {
        ...ctx,
        userId: ctx.userId,
        companyId: ctx.companyId,
      },
    });
  }
);

/**
 * Shaped procedure - requires authentication, company, AND active business shape
 * Blocks operations if company businessShape is PENDING
 */
export const shapedProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    if (ctx.businessShape === BusinessShape.PENDING) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          'Operations blocked until business shape is selected. Please complete company setup.',
      });
    }

    return next({
      ctx: {
        ...ctx,
        businessShape: ctx.businessShape as BusinessShape,
      },
    });
  }
);
