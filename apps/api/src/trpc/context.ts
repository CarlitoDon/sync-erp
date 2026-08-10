import * as trpcExpress from '@trpc/server/adapters/express';
import { prisma, BusinessShape } from '@sync-erp/database';

// Extend Express Request type to include our auth context
interface RequestWithContext {
  context?: {
    userId?: string;
    companyId?: string;
    isSessionAuth?: boolean;
  };
  correlationId?: string;
}

export type SessionTenantAdmission =
  | 'admitted'
  | 'denied'
  | 'not-selected';

/**
 * Creates context for each tRPC request
 * Includes authenticated user, company, and correlation ID from Express middleware
 */
export const createContext = async ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) => {
  const extReq = req as RequestWithContext;
  const userId = extReq.context?.userId;
  const companyId = extReq.context?.companyId;
  const isSessionAuth = extReq.context?.isSessionAuth;
  const correlationId = extReq.correlationId;

  // Fetch company's businessShape and user's role/permissions if companyId is set
  let businessShape: BusinessShape | undefined;
  let userRole: string | undefined;
  let userPermissions: string[] = [];
  let sessionTenantAdmission: SessionTenantAdmission | undefined;

  if (companyId && userId) {
    const [company, membership] = await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: { businessShape: true },
      }),
      prisma.companyMember.findUnique({
        where: { userId_companyId: { userId, companyId } },
        include: {
          role: {
            select: {
              name: true,
              permissions: {
                include: {
                  permission: {
                    select: { module: true, action: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);
    sessionTenantAdmission =
      company && membership ? 'admitted' : 'denied';

    // Only expose tenant-derived context after the session has been admitted
    // to the selected company. Public procedures do not use this gate, while
    // protected procedures enforce the admission marker below.
    if (company && membership) {
      businessShape = company.businessShape;
      userRole = membership.role?.name ?? undefined;

      // Build permissions array: ['bill:void', 'payment:void', ...]
      if (membership.role?.permissions) {
        userPermissions = membership.role.permissions.map(
          (rp) => `${rp.permission.module}:${rp.permission.action}`
        );
      }
    }
  } else if (userId) {
    sessionTenantAdmission = 'not-selected';
  }

  return {
    req,
    res,
    userId,
    companyId,
    isSessionAuth,
    correlationId,
    idempotencyKey: req.headers['idempotency-key'] as string | undefined,
    integrationId: req.headers['x-integration-id'] as string | undefined,
    // API-key provenance is established only by apiKeyProcedure after
    // validating the Bearer token. Never derive it from a caller-controlled
    // header in the base context.
    isApiKeyAuth: false,
    businessShape,
    userRole,
    userPermissions, // Granular RBAC: ['bill:void', 'payment:void', ...]
    sessionTenantAdmission,
    permissions: undefined as string[] | undefined,
    apiKeyId: undefined as string | undefined,
  };
};

type CreatedContext = Awaited<ReturnType<typeof createContext>>;

// Keep the admission marker optional for direct createCaller users and
// non-session principals. HTTP tRPC requests created above always populate it
// for a session user that supplied X-Company-Id.
export type Context = Omit<
  CreatedContext,
  'sessionTenantAdmission' | 'isSessionAuth'
> & {
  sessionTenantAdmission?: SessionTenantAdmission;
  isSessionAuth?: boolean;
};
