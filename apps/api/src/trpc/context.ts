import * as trpcExpress from '@trpc/server/adapters/express';
import { prisma, BusinessShape } from '@sync-erp/database';

// Extend Express Request type to include our auth context
interface RequestWithContext {
  context?: {
    userId?: string;
    companyId?: string;
  };
  correlationId?: string;
}

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
  const correlationId = extReq.correlationId;

  // Fetch company's businessShape and user's role/permissions if companyId is set
  let businessShape: BusinessShape | undefined;
  let userRole: string | undefined;
  let userPermissions: string[] = [];

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
    businessShape = company?.businessShape ?? undefined;
    userRole = membership?.role?.name ?? undefined;

    // Build permissions array: ['bill:void', 'payment:void', ...]
    if (membership?.role?.permissions) {
      userPermissions = membership.role.permissions.map(
        (rp) => `${rp.permission.module}:${rp.permission.action}`
      );
    }
  }

  return {
    req,
    res,
    userId,
    companyId,
    correlationId,
    businessShape,
    userRole,
    userPermissions, // Granular RBAC: ['bill:void', 'payment:void', ...]
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;
