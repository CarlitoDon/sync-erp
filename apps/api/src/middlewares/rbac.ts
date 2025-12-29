import { Request, Response, NextFunction } from 'express';
import {
  prisma,
  PermissionModule,
  PermissionAction,
  PermissionScope,
} from '@sync-erp/database';
import { ForbiddenError } from './errorHandler';

/**
 * Permission structure: module:action
 * e.g., "SALES:CREATE", "FINANCE:APPROVE", "INVENTORY:VOID"
 */
type Permission = string;

interface RBACConfig {
  module: string;
  action: string;
}

/**
 * Helper to check if permission matches (supports legacy wildcard '*' as string)
 * Now enums don't have '*', so we cast to string for comparison
 */
function permissionMatches(
  permModule: PermissionModule,
  permAction: PermissionAction,
  requiredModule: string,
  requiredAction: string
): boolean {
  const moduleStr = String(permModule);
  const actionStr = String(permAction);
  // Match if exact match OR wildcard (legacy support via string cast)
  const moduleMatch =
    moduleStr === requiredModule || moduleStr === '*';
  const actionMatch =
    actionStr === requiredAction || actionStr === '*';
  return moduleMatch && actionMatch;
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
      const hasPermission = membership.role.permissions.some((rp) =>
        permissionMatches(
          rp.permission.module,
          rp.permission.action,
          module.toUpperCase(),
          action.toUpperCase()
        )
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
        return membership.role!.permissions.some((rp) =>
          permissionMatches(
            rp.permission.module,
            rp.permission.action,
            module.toUpperCase(),
            action.toUpperCase()
          )
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
   * NOTE: Uses Prisma enums - no wildcard '*' support in enums
   */
  async seedDefaultPermissions() {
    const defaultPermissions: {
      module: PermissionModule;
      action: PermissionAction;
    }[] = [
      // Sales
      {
        module: PermissionModule.SALES,
        action: PermissionAction.READ,
      },
      {
        module: PermissionModule.SALES,
        action: PermissionAction.CREATE,
      },
      {
        module: PermissionModule.SALES,
        action: PermissionAction.APPROVE,
      },
      {
        module: PermissionModule.SALES,
        action: PermissionAction.DELETE,
      },
      // Purchasing
      {
        module: PermissionModule.PURCHASING,
        action: PermissionAction.READ,
      },
      {
        module: PermissionModule.PURCHASING,
        action: PermissionAction.CREATE,
      },
      {
        module: PermissionModule.PURCHASING,
        action: PermissionAction.APPROVE,
      },
      {
        module: PermissionModule.PURCHASING,
        action: PermissionAction.DELETE,
      },
      // Inventory
      {
        module: PermissionModule.INVENTORY,
        action: PermissionAction.READ,
      },
      {
        module: PermissionModule.INVENTORY,
        action: PermissionAction.CREATE,
      },
      {
        module: PermissionModule.INVENTORY,
        action: PermissionAction.UPDATE,
      },
      {
        module: PermissionModule.INVENTORY,
        action: PermissionAction.VOID,
      },
      // Finance
      {
        module: PermissionModule.FINANCE,
        action: PermissionAction.READ,
      },
      {
        module: PermissionModule.FINANCE,
        action: PermissionAction.CREATE,
      },
      {
        module: PermissionModule.FINANCE,
        action: PermissionAction.APPROVE,
      },
      {
        module: PermissionModule.FINANCE,
        action: PermissionAction.VOID,
      },
      // Users/Company
      {
        module: PermissionModule.USERS,
        action: PermissionAction.READ,
      },
      {
        module: PermissionModule.USERS,
        action: PermissionAction.CREATE,
      },
      {
        module: PermissionModule.USERS,
        action: PermissionAction.UPDATE,
      },
      {
        module: PermissionModule.USERS,
        action: PermissionAction.DELETE,
      },
      {
        module: PermissionModule.COMPANY,
        action: PermissionAction.READ,
      },
      {
        module: PermissionModule.COMPANY,
        action: PermissionAction.UPDATE,
      },
    ];

    for (const perm of defaultPermissions) {
      await prisma.permission.upsert({
        where: {
          module_action_scope: {
            module: perm.module,
            action: perm.action,
            scope: PermissionScope.ALL,
          },
        },
        update: {},
        create: { ...perm, scope: PermissionScope.ALL },
      });
    }
  }
}
