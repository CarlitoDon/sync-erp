import {
  prisma,
  type AuthAuditAction,
  type AuthAuditLog,
  Prisma,
} from '@sync-erp/database';

export interface CreateAuthAuditLogInput {
  userId?: string | null;
  email: string;
  action: AuthAuditAction;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
}

export class AuthAuditRepository {
  async create(
    input: CreateAuthAuditLogInput
  ): Promise<AuthAuditLog> {
    return prisma.authAuditLog.create({
      data: {
        userId: input.userId ?? null,
        email: input.email,
        action: input.action,
        correlationId: input.correlationId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: input.metadata,
      },
    });
  }
}
