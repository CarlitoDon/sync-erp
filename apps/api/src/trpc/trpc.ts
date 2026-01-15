import { initTRPC, TRPCError } from '@trpc/server';
import { middlewareMarker } from '@trpc/server/unstable-core-do-not-import';
import { Context } from './context';
import superjson from 'superjson';
import { BusinessShape, IdempotencyScope } from '@sync-erp/database';
import { IdempotencyService } from '../modules/idempotency/idempotency.service';

export interface Meta {
  idempotencyScope?: IdempotencyScope;
}

const t = initTRPC.context<Context>().meta<Meta>().create({
  transformer: superjson, // For Date serialization
});

const idempotencyService = new IdempotencyService();

const idempotencyMiddleware = t.middleware(
  async ({ ctx, meta, next }) => {
    const key = ctx.idempotencyKey;
    const scope = meta?.idempotencyScope;

    // Only run if idempotency key provided AND scope is defined for this procedure
    if (scope && key && ctx.companyId) {
      try {
        const cachedResponse = await idempotencyService.acquireLock(
          key,
          ctx.companyId,
          scope
        );

        if (cachedResponse !== null) {
          // Return cached response (short-circuit)
          // Use tRPC's middlewareMarker for proper typing
          return {
            ok: true as const,
            data: cachedResponse,
            marker: middlewareMarker,
          };
        }
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }
    }

    // Proceed with request
    const result = await next();

    // Save result or failure
    if (scope && key && ctx.companyId) {
      if (result.ok) {
        // Store success response
        // We run this in background (fire and forget) to not block response?
        // Better await it to ensure consistency, but it adds latency.
        // For safety, await it.
        await idempotencyService.complete(key, result.data);
      } else {
        // Store failure (or allow retry)
        // We store failure to allow retry with same key (via fail() logic which deletes it or marks failed)
        await idempotencyService.fail(key, result.error);
      }
    }

    return result;
  }
);

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
export const protectedProcedure = t.procedure
  .use(async ({ ctx, next }) => {
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
  })
  .use(idempotencyMiddleware);

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

/**
 * API Key procedure - for external integrations (multi-tenant)
 * Validates Bearer token from Authorization header
 * Injects companyId and permissions from validated API key
 */
export const apiKeyProcedure = t.procedure
  .use(async ({ ctx, next }) => {
    // Import dynamically to avoid circular dependency
    const { apiKeyService } =
      await import('../services/api-key.service');

    const authHeader = ctx.req?.headers?.authorization;

    // Check for Bearer token
    if (!authHeader?.startsWith('Bearer ')) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message:
          'Missing or invalid Authorization header. Expected: Bearer <api_key>',
      });
    }

    const rawKey = authHeader.replace('Bearer ', '');
    const result = await apiKeyService.validateKey(rawKey);

    if (!result) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired API key',
      });
    }

    return next({
      ctx: {
        ...ctx,
        companyId: result.companyId,
        permissions: result.permissions,
        apiKeyId: result.keyId,
        isApiKeyAuth: true,
      },
    });
  })
  .use(idempotencyMiddleware);
