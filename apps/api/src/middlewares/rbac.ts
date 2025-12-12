import { Request, Response, NextFunction } from 'express';
import { prisma } from '@sync-erp/database';
import { ForbiddenError } from './errorHandler';

/**
 * Permission structure: module:action
 * e.g., "orders:create", "invoices:approve", "finance:view"
 */
type Permission = string;

interface RBACConfig {
  module: string;
  action: string;
}

/**
 * RBAC Middleware Factory
 * Creates middleware that checks if user has required permission
 */
export function requirePermission(config: RBACConfig | Permission) {
  const { module, action } =
    typeof config === 'string'
      ? { module: config.split(':')[0], action: config.split(':')[1] }
      : config;

  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const userId = req.context.userId;
      const companyId = req.context.companyId;

      if (!userId || !companyId) {
        throw ForbiddenError('Authentication required');
      }

      // Get user's role in this company
      const membership = await prisma.companyMember.findUnique({
        where: {
          userId_companyId: {
            userId,
            companyId,
          },
        },
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

      if (!membership) {
        throw ForbiddenError('Not a member of this company');
      }

      // If no role assigned, check for default permissions (MVP: allow all)
      if (!membership.role) {
        // MVP: Allow users without roles to access everything
        // Production: Implement default restricted permissions
        return next();
      }

      // Check if role has required permission
      const hasPermission = membership.role.permissions.some(
        (rp) =>
          (rp.permission.module === module ||
            rp.permission.module === '*') &&
          (rp.permission.action === action ||
            rp.permission.action === '*')
      );

      if (!hasPermission) {
        throw ForbiddenError(
          `Permission denied: requires ${module}:${action}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Check multiple permissions (any of them)
 */
export function requireAnyPermission(...permissions: Permission[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const userId = req.context.userId;
      const companyId = req.context.companyId;

      if (!userId || !companyId) {
        throw ForbiddenError('Authentication required');
      }

      const membership = await prisma.companyMember.findUnique({
        where: {
          userId_companyId: {
            userId,
            companyId,
          },
        },
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

      if (!membership) {
        throw ForbiddenError('Not a member of this company');
      }

      // MVP: Allow all if no role
      if (!membership.role) {
        return next();
      }

      const hasAnyPermission = permissions.some((perm) => {
        const [module, action] = perm.split(':');
        return membership.role!.permissions.some(
          (rp) =>
            (rp.permission.module === module ||
              rp.permission.module === '*') &&
            (rp.permission.action === action ||
              rp.permission.action === '*')
        );
      });

      if (!hasAnyPermission) {
        throw ForbiddenError(
          `Permission denied: requires one of ${permissions.join(', ')}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * RBAC Service for managing roles and permissions
 */
export class RBACService {
  /**
   * Create a new role
   */
  async createRole(companyId: string, name: string) {
    return prisma.role.create({
      data: { companyId, name },
    });
  }

  /**
   * List roles for a company
   */
  async listRoles(companyId: string) {
    return prisma.role.findMany({
      where: { companyId },
      include: { permissions: { include: { permission: true } } },
    });
  }

  /**
   * Assign permission to role
   */
  async assignPermission(roleId: string, permissionId: string) {
    return prisma.rolePermission.create({
      data: { roleId, permissionId },
    });
  }

  /**
   * Assign role to user
   */
  async assignRoleToUser(
    userId: string,
    companyId: string,
    roleId: string
  ) {
    return prisma.companyMember.update({
      where: {
        userId_companyId: { userId, companyId },
      },
      data: { roleId },
    });
  }

  /**
   * Get or create default permissions
   */
  async seedDefaultPermissions() {
    const defaultPermissions = [
      // Orders
      { module: 'orders', action: 'view' },
      { module: 'orders', action: 'create' },
      { module: 'orders', action: 'approve' },
      { module: 'orders', action: 'delete' },
      // Inventory
      { module: 'inventory', action: 'view' },
      { module: 'inventory', action: 'adjust' },
      // Finance
      { module: 'finance', action: 'view' },
      { module: 'finance', action: 'create' },
      { module: 'finance', action: 'approve' },
      // Partners
      { module: 'partners', action: 'view' },
      { module: 'partners', action: 'create' },
      { module: 'partners', action: 'edit' },
      { module: 'partners', action: 'delete' },
      // Products
      { module: 'products', action: 'view' },
      { module: 'products', action: 'create' },
      { module: 'products', action: 'edit' },
      { module: 'products', action: 'delete' },
      // Admin
      { module: '*', action: '*' }, // Super admin
    ];

    for (const perm of defaultPermissions) {
      await prisma.permission.upsert({
        where: {
          module_action_scope: {
            module: perm.module,
            action: perm.action,
            scope: 'ALL',
          },
        },
        update: {},
        create: { ...perm, scope: 'ALL' },
      });
    }
  }
}
