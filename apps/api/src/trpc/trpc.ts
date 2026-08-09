import { initTRPC, TRPCError } from '@trpc/server';
import { middlewareMarker } from '@trpc/server/unstable-core-do-not-import';
import { Context } from './context';
import superjson from 'superjson';
import {
  BusinessShape,
  IdempotencyScope,
  Prisma,
} from '@sync-erp/database';
import { IdempotencyService } from '../modules/common/services/idempotency.service';
import {
  adaptiveRateLimitService,
  type PublicRateLimitConfig,
} from '../modules/common/services/adaptive-rate-limit.service';
import {
  canIssueApiKeyPermission,
  canSessionPerformCapability,
  getActorApiKeyPermissions,
  getInvalidApiKeyPermissions,
  normalizeApiKeyPermissions,
  type ApiKeyPermission,
  type SessionCapability,
} from '../modules/auth/rbac.policy';

export interface Meta {
  idempotencyScope?: IdempotencyScope;
}

const t = initTRPC.context<Context>().meta<Meta>().create({
  transformer: superjson, // For Date serialization
});

const idempotencyService = new IdempotencyService();

function assertSessionTenantAdmission(ctx: Context): void {
  // Preserve the explicit denial produced by createContext even when a
  // trusted in-process caller does not carry the middleware provenance flag.
  if (ctx.companyId && ctx.sessionTenantAdmission === 'denied') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'User does not belong to this company',
    });
  }

  // Direct createCaller users are trusted in-process callers and do not carry
  // the HTTP session provenance that this check protects. Real session
  // requests are marked by optionalAuthMiddleware, including malformed or
  // missing membership states, so an incomplete session context fails closed.
  if (!ctx.isSessionAuth || !ctx.companyId) {
    return;
  }

  if (ctx.sessionTenantAdmission === 'admitted') {
    return;
  }

  throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'User does not belong to this company',
  });
}

function getPublicClientIdentifier(req: Context['req']): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor;
  const forwardedIp = forwardedValue?.split(',')[0]?.trim();
  const ip =
    forwardedIp ||
    req.ip ||
    req.socket.remoteAddress ||
    'unknown-client';
  const userAgent = req.headers['user-agent'] || 'unknown-agent';

  return `${ip}:${userAgent}`;
}

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
        await idempotencyService.complete(
          key,
          result.data as Prisma.InputJsonObject
        );
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

export const publicRateLimit = (config: PublicRateLimitConfig) =>
  t.middleware(async ({ ctx, next }) => {
    const identifier = getPublicClientIdentifier(ctx.req);
    const result = await adaptiveRateLimitService.consume(
      identifier,
      config
    );

    if (!result.allowed) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message:
          'Too many authentication attempts. Please wait before trying again.',
      });
    }

    return next();
  });

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

    assertSessionTenantAdmission(ctx);

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

function assertSessionCapability(
  ctx: Context,
  capability: SessionCapability
): void {
  if (ctx.isApiKeyAuth || !ctx.userId || !ctx.companyId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Session company authorization required',
    });
  }

  if (
    !canSessionPerformCapability(
      ctx.userRole,
      ctx.userPermissions,
      capability
    )
  ) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Insufficient company permission',
    });
  }
}

export const requireSessionCapability = (
  capability: SessionCapability
) =>
  t.middleware(async ({ ctx, next }) => {
    assertSessionCapability(ctx, capability);
    return next();
  });

export const adminProcedure = protectedProcedure.use(
  requireSessionCapability('admin')
);

export const apiKeyManagementProcedure = protectedProcedure.use(
  requireSessionCapability('apiKeyManagement')
);

export const integrationManagementProcedure = protectedProcedure.use(
  requireSessionCapability('integrationManagement')
);

export const roleManagementProcedure = protectedProcedure.use(
  requireSessionCapability('roleManagement')
);

/**
 * Validate the permission set requested for a newly created or updated key
 * against the actor's effective, membership-derived authority.
 */
export function getSafeApiKeyPermissions(
  ctx: Context,
  requested?: readonly string[]
): string[] {
  assertSessionCapability(ctx, 'apiKeyManagement');

  const actorPermissions = getActorApiKeyPermissions(
    ctx.userRole,
    ctx.userPermissions
  );
  const defaultPermissions = actorPermissions;
  const normalized = normalizeApiKeyPermissions(
    requested ?? defaultPermissions
  );
  const invalid = getInvalidApiKeyPermissions(normalized);

  if (invalid.length > 0) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Requested API key permission is not supported',
    });
  }

  for (const permission of normalized as ApiKeyPermission[]) {
    if (
      !canIssueApiKeyPermission(
        ctx.userRole,
        ctx.userPermissions,
        permission
      )
    ) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Requested API key permission exceeds actor authority',
      });
    }
  }

  return normalized;
}

/**
 * API Key procedure - for external integrations (multi-tenant)
 * Validates Bearer token from Authorization header
 * Injects companyId and permissions from validated API key
 * Enforces rate limiting (Redis-backed, persists across restarts)
 */

import { redisRateLimitService } from '../modules/common/services/redis-rate-limit.service';

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

    // Enforce rate limiting (Redis-backed)
    const rlResult = await redisRateLimitService.consume(
      `apikey:${result.keyId}`,
      {
        namespace: 'api-key',
        maxAttempts: result.rateLimit || 1000,
        windowMs: 3600_000, // 1 hour window
      }
    );
    if (!rlResult.allowed) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded. Please try again later.',
      });
    }

    return next({
      ctx: {
        ...ctx,
        // Do not let a valid API key inherit session identity, role, or
        // membership-derived permissions from a concurrent browser cookie.
        userId: undefined,
        userRole: undefined,
        userPermissions: [],
        isSessionAuth: false,
        sessionTenantAdmission: undefined,
        businessShape: undefined,
        companyId: result.companyId,
        // Only normalized permissions returned by the validated key record
        // enter the API-key principal context.
        permissions: normalizeApiKeyPermissions(result.permissions),
        apiKeyId: result.keyId,
        isApiKeyAuth: true,
        integrationId: result.integrationId,
      },
    });
  })
  .use(idempotencyMiddleware);

/**
 * Bot procedure - for internal bot service communication
 * Validates using SYNC_ERP_API_SECRET environment variable instead of database API keys
 * This allows bot service to update its status without needing database setup
 */
export const botProcedure = t.procedure.use(async ({ ctx, next }) => {
  // Use standardized environment variable
  const { createEnvValidator } = await import('@sync-erp/shared');
  const env = createEnvValidator('api');
  const apiSecret = env.getApiSecret();

  const authHeader = ctx.req?.headers?.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message:
        'Missing or invalid Authorization header. Expected: Bearer <api_secret>',
    });
  }

  const providedSecret = authHeader.replace('Bearer ', '');

  if (providedSecret !== apiSecret) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid API secret',
    });
  }

  return next({
    ctx: {
      ...ctx,
      isBotService: true,
    },
  });
});

/**
 * Permission enforcement middleware factory
 * Use: apiKeyProcedure.use(requirePermission('rental:write')).mutation(...)
 */
export const requirePermission = (permission: string) =>
  t.middleware(async ({ ctx, next }) => {
    // This middleware is intentionally API-key-only. Session principals use
    // membership-derived catalog permissions through requireSessionCapability.
    if (!ctx.isApiKeyAuth) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'API key authorization required',
      });
    }

    const permissions = ctx.permissions;

    if (!permissions?.includes(permission.trim().toLowerCase())) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Missing required permission: ${permission}`,
      });
    }

    return next();
  });
