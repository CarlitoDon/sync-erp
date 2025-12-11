import { User, Session } from '@sync-erp/database';

declare global {
  namespace Express {
    interface Request {
      context: {
        userId?: string;
        companyId?: string;
      };
      user?: User;
      session?: Session;
    }
  }
}

export {};
