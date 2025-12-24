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

  // Fetch company's businessShape if companyId is set
  let businessShape: BusinessShape | undefined;
  if (companyId) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { businessShape: true },
    });
    businessShape = company?.businessShape ?? undefined;
  }

  return {
    req,
    res,
    userId,
    companyId,
    correlationId,
    businessShape,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;
