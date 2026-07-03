import { Prisma } from './generated/client/client.js';
import { getRequestContext } from './als.js';

const SKIP_MODELS = new Set([
  'AuditLog',
  'AuthAuditLog',
  'SagaLog',
  'TenantWebhookOutbox',
  'RentalWebhookOutbox',
  'IdempotencyKey',
  'AutoAuditLog',
]);

function getRecordId(
  operation: string,
  result: unknown,
  args: Record<string, unknown>
): string | null {
  if (operation === 'create') {
    if (result && typeof result === 'object' && 'id' in result) {
      return String((result as { id: unknown }).id);
    }
  }
  if (
    args.where &&
    typeof args.where === 'object' &&
    'id' in (args.where as Record<string, unknown>)
  ) {
    return String((args.where as Record<string, unknown>).id);
  }
  return null;
}

function sanitizeArgs(
  args: Record<string, unknown>
): Record<string, unknown> | null {
  if (!args || Object.keys(args).length === 0) return null;

  const safe: Record<string, unknown> = {};

  if (args.data && typeof args.data === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      args.data as Record<string, unknown>
    )) {
      if (
        key === 'password' ||
        key === 'passwordHash' ||
        key === 'webhookSecret'
      ) {
        cleaned[key] = '[REDACTED]';
      } else {
        cleaned[key] = value;
      }
    }
    safe.data = cleaned;
  } else {
    safe.data = args.data;
  }

  if (args.where) safe.where = args.where;

  return safe;
}

/**
 * Create Prisma $extends extension that auto-records mutations.
 * Attached to PrismaClient via prisma.$extends().
 */
export function createAutoAuditExtension() {
  return Prisma.defineExtension({
    name: 'auto-audit',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const result = await query(args);

          const ctx = getRequestContext();
          if (
            !ctx ||
            !model ||
            SKIP_MODELS.has(model)
          ) {
            return result;
          }

          // Only capture mutations
          if (
            operation !== 'create' &&
            operation !== 'update' &&
            operation !== 'delete'
          ) {
            return result;
          }

          // Fire-and-forget: don't slow the request
          captureMutation({
            modelName: model,
            action: operation,
            recordId: getRecordId(operation, result, args as Record<string, unknown>),
            companyId: ctx.companyId,
            actorId: ctx.userId,
            correlationId: ctx.correlationId ?? null,
            args: sanitizeArgs(args as Record<string, unknown>),
          }).catch((err) =>
            console.error('[AutoAudit] Failed to record:', err)
          );

          return result;
        },
      },
    },
  });
}

async function captureMutation(data: {
  modelName: string;
  action: string;
  recordId: string | null;
  companyId: string;
  actorId: string;
  correlationId: string | null;
  args: Record<string, unknown> | null;
}): Promise<void> {
  try {
    // Import dynamically to avoid circular deps
    const { prisma } = await import('./client.js');
    await (prisma as any).autoAuditLog.create({
      data,
    });
  } catch (err) {
    console.error('[AutoAudit] captureMutation failed:', err);
  }
}
