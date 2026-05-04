import {
  type AuthAuditAction,
  Prisma,
} from '@sync-erp/database';
import {
  AuthAuditRepository,
  type CreateAuthAuditLogInput,
} from './auth-audit.repository';

export interface AuthAuditContext {
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RecordAuthAuditInput {
  userId?: string | null;
  email: string;
  action: AuthAuditAction;
  metadata?: Prisma.InputJsonValue;
  context?: AuthAuditContext;
}

export class AuthAuditService {
  constructor(
    private readonly repository: AuthAuditRepository = new AuthAuditRepository()
  ) {}

  async record(input: RecordAuthAuditInput) {
    const payload: CreateAuthAuditLogInput = {
      userId: input.userId ?? null,
      email: input.email,
      action: input.action,
      correlationId: input.context?.correlationId,
      ipAddress: input.context?.ipAddress,
      userAgent: input.context?.userAgent,
      metadata: input.metadata,
    };

    return this.repository.create(payload);
  }
}
