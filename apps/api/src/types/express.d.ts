import { User, Session, BusinessShape } from '@sync-erp/database';

/**
 * Company context loaded by authMiddleware.
 * Includes businessShape for Policy layer checks.
 */
interface CompanyContext {
  id: string;
  name: string;
  businessShape: BusinessShape;
}

declare global {
  namespace Express {
    interface Request {
      context: {
        userId?: string;
        companyId?: string;
      };
      user?: User;
      session?: Session;
      /**
       * Company context with businessShape for Policy checks.
       * Available after authMiddleware runs.
       */
      company?: CompanyContext;
    }
  }
}

export {};

