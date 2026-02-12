/**
 * Shared permission/RBAC utility functions.
 * Extracted from duplicated checks in bill.router.ts and payment.service.ts.
 */
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

/**
 * Check if a user has the required permission.
 * Supports wildcard permissions (e.g., `FINANCE:*` or `*:*`).
 *
 * @param userPermissions - Array of permission strings (e.g., ['FINANCE:READ', 'FINANCE:VOID'])
 * @param required - Required permission string (e.g., 'FINANCE:DELETE')
 * @throws DomainError with FORBIDDEN code if permission is missing
 */
export function ensureHasPermission(
  userPermissions: string[] | undefined,
  required: string
): void {
  const normalized =
    userPermissions?.map((p) => p.toUpperCase()) ?? [];
  const [module] = required.toUpperCase().split(':');

  const hasPermission =
    normalized.includes(required.toUpperCase()) ||
    normalized.includes(`${module}:*`) ||
    normalized.includes('*:*');

  if (!hasPermission) {
    throw new DomainError(
      `Missing permission: ${required}`,
      403,
      DomainErrorCodes.FORBIDDEN
    );
  }
}
