import { prisma } from '@sync-erp/database';

/**
 * Permission Service - Granular RBAC
 *
 * Checks user permissions based on:
 * - User's role in the company (via CompanyMember.roleId)
 * - Role's permissions (via RolePermission)
 * - Permission's module/action/scope
 *
 * Example: checkPermission(userId, companyId, 'bill', 'void')
 */

export interface PermissionCheck {
  module: string;
  action: string;
  scope?: string; // 'ALL' | 'OWN' | specific scope
}

/**
 * Get all permissions for a user in a company.
 * Returns array of permission strings like ['bill:void', 'payment:void']
 */
export async function getUserPermissions(
  userId: string,
  companyId: string
): Promise<string[]> {
  const membership = await prisma.companyMember.findUnique({
    where: { userId_companyId: { userId, companyId } },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  if (!membership?.role) {
    return [];
  }

  return membership.role.permissions.map(
    (rp) => `${rp.permission.module}:${rp.permission.action}`
  );
}

/**
 * Check if user has a specific permission.
 * Supports wildcard with '*' for admin-level access.
 */
export async function checkPermission(
  userId: string,
  companyId: string,
  module: string,
  action: string
): Promise<boolean> {
  const permissions = await getUserPermissions(userId, companyId);

  // Check for exact match
  if (permissions.includes(`${module}:${action}`)) {
    return true;
  }

  // Check for module wildcard (e.g., 'bill:*')
  if (permissions.includes(`${module}:*`)) {
    return true;
  }

  // Check for global admin (e.g., '*:*')
  if (permissions.includes('*:*')) {
    return true;
  }

  return false;
}

/**
 * Ensure user has permission, throw 403 if not.
 * Use in services before sensitive operations.
 */
export async function ensurePermission(
  userId: string,
  companyId: string,
  module: string,
  action: string
): Promise<void> {
  const hasPermission = await checkPermission(
    userId,
    companyId,
    module,
    action
  );

  if (!hasPermission) {
    const { DomainError, DomainErrorCodes } =
      await import('@sync-erp/shared');
    throw new DomainError(
      `Missing permission: ${module}:${action}`,
      403,
      DomainErrorCodes.FORBIDDEN
    );
  }
}

/**
 * Permission constants for P2P flow operations
 */
export const P2P_PERMISSIONS = {
  // Bill operations
  BILL_VOID: { module: 'bill', action: 'void' },
  BILL_POST: { module: 'bill', action: 'post' },
  BILL_CREATE: { module: 'bill', action: 'create' },

  // Payment operations
  PAYMENT_VOID: { module: 'payment', action: 'void' },
  PAYMENT_CREATE: { module: 'payment', action: 'create' },

  // Inventory operations
  GRN_VOID: { module: 'inventory', action: 'void_grn' },
  SHIPMENT_VOID: { module: 'inventory', action: 'void_shipment' },
  GRN_POST: { module: 'inventory', action: 'post_grn' },
  SHIPMENT_POST: { module: 'inventory', action: 'post_shipment' },

  // Order operations
  PO_CANCEL: { module: 'purchase_order', action: 'cancel' },
  PO_CLOSE: { module: 'purchase_order', action: 'close' },
  SO_CANCEL: { module: 'sales_order', action: 'cancel' },
} as const;

export type P2PPermission =
  (typeof P2P_PERMISSIONS)[keyof typeof P2P_PERMISSIONS];
