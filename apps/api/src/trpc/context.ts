import * as trpcExpress from '@trpc/server/adapters/express';

// Extend Express Request type to include our auth context
interface RequestWithContext {
  context?: {
    userId?: string;
    companyId?: string;
  };
}

/**
 * Creates context for each tRPC request
 * Includes authenticated user and company from Express middleware
 */
export const createContext = ({
  req,
  res,
}: trpcExpress.CreateExpressContextOptions) => {
  // Auth middleware already set req.context
  const user = (req as RequestWithContext).context?.userId;
  const companyId = (req as RequestWithContext).context?.companyId;

  return {
    req,
    res,
    userId: user,
    companyId,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;
