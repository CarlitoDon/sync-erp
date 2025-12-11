import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { mockPrisma, resetMocks } from '../mocks/prisma.mock';

// Mock the database module
vi.mock('@sync-erp/database', () => ({
  prisma: mockPrisma,
}));

// Add permission and rolePermission to mock
(mockPrisma as any).permission = {
  upsert: vi.fn(),
  findMany: vi.fn(),
};
(mockPrisma as any).rolePermission = {
  create: vi.fn(),
};

// Import after mocking
import {
  requirePermission,
  requireAnyPermission,
  RBACService,
} from '../../../src/middlewares/rbac';

// Mock request, response, next
const createMockRequest = (context: { userId?: string; companyId?: string }) => {
  return { context } as unknown as Request;
};

const createMockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
};

const mockNext = vi.fn() as unknown as NextFunction;

describe('RBAC Middleware', () => {
  beforeEach(() => {
    resetMocks();
    vi.clearAllMocks();
  });

  describe('requirePermission', () => {
    it('should call next() if user has no role (MVP behavior)', async () => {
      const req = createMockRequest({ userId: 'user-1', companyId: 'company-1' });
      const res = createMockResponse();

      // User is member but has no role
      mockPrisma.companyMember.findUnique.mockResolvedValue({
        userId: 'user-1',
        companyId: 'company-1',
        role: null,
      });

      const middleware = requirePermission({ module: 'orders', action: 'create' });
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next() if user has required permission', async () => {
      const req = createMockRequest({ userId: 'user-1', companyId: 'company-1' });
      const res = createMockResponse();

      mockPrisma.companyMember.findUnique.mockResolvedValue({
        userId: 'user-1',
        companyId: 'company-1',
        role: {
          id: 'role-1',
          name: 'Manager',
          permissions: [{ permission: { module: 'orders', action: 'create' } }],
        },
      });

      const middleware = requirePermission('orders:create');
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next() with error if user lacks permission', async () => {
      const req = createMockRequest({ userId: 'user-1', companyId: 'company-1' });
      const res = createMockResponse();

      mockPrisma.companyMember.findUnique.mockResolvedValue({
        userId: 'user-1',
        companyId: 'company-1',
        role: {
          id: 'role-1',
          name: 'Viewer',
          permissions: [{ permission: { module: 'orders', action: 'view' } }],
        },
      });

      const middleware = requirePermission('orders:create');
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next() with error if not authenticated', async () => {
      const req = createMockRequest({ userId: undefined, companyId: undefined });
      const res = createMockResponse();

      const middleware = requirePermission('orders:create');
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next() with error if not a member', async () => {
      const req = createMockRequest({ userId: 'user-1', companyId: 'company-1' });
      const res = createMockResponse();

      mockPrisma.companyMember.findUnique.mockResolvedValue(null);

      const middleware = requirePermission('orders:create');
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should allow wildcard permission (*:*)', async () => {
      const req = createMockRequest({ userId: 'user-1', companyId: 'company-1' });
      const res = createMockResponse();

      mockPrisma.companyMember.findUnique.mockResolvedValue({
        userId: 'user-1',
        companyId: 'company-1',
        role: {
          id: 'role-1',
          name: 'Admin',
          permissions: [{ permission: { module: '*', action: '*' } }],
        },
      });

      const middleware = requirePermission('finance:approve');
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('requireAnyPermission', () => {
    it('should call next() if user has one of the required permissions', async () => {
      const req = createMockRequest({ userId: 'user-1', companyId: 'company-1' });
      const res = createMockResponse();

      mockPrisma.companyMember.findUnique.mockResolvedValue({
        userId: 'user-1',
        companyId: 'company-1',
        role: {
          id: 'role-1',
          permissions: [{ permission: { module: 'orders', action: 'view' } }],
        },
      });

      const middleware = requireAnyPermission('orders:view', 'orders:create');
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next() with error if user has none of the permissions', async () => {
      const req = createMockRequest({ userId: 'user-1', companyId: 'company-1' });
      const res = createMockResponse();

      mockPrisma.companyMember.findUnique.mockResolvedValue({
        userId: 'user-1',
        companyId: 'company-1',
        role: {
          id: 'role-1',
          permissions: [{ permission: { module: 'inventory', action: 'view' } }],
        },
      });

      const middleware = requireAnyPermission('orders:view', 'orders:create');
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call next() if user has no role (MVP behavior)', async () => {
      const req = createMockRequest({ userId: 'user-1', companyId: 'company-1' });
      const res = createMockResponse();

      mockPrisma.companyMember.findUnique.mockResolvedValue({
        userId: 'user-1',
        companyId: 'company-1',
        role: null,
      });

      const middleware = requireAnyPermission('orders:view', 'orders:create');
      await middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('RBACService', () => {
    let service: RBACService;

    beforeEach(() => {
      service = new RBACService();
    });

    describe('createRole', () => {
      it('should create a role', async () => {
        const mockRole = { id: 'role-1', name: 'Manager', companyId: 'company-1' };
        mockPrisma.role.create.mockResolvedValue(mockRole);

        const result = await service.createRole('company-1', 'Manager');

        expect(result).toEqual(mockRole);
      });
    });

    describe('listRoles', () => {
      it('should list roles for a company', async () => {
        const mockRoles = [
          { id: 'role-1', name: 'Manager' },
          { id: 'role-2', name: 'Viewer' },
        ];
        mockPrisma.role.findMany.mockResolvedValue(mockRoles);

        const result = await service.listRoles('company-1');

        expect(result).toHaveLength(2);
      });
    });

    describe('assignPermission', () => {
      it('should assign permission to role', async () => {
        const mockRolePermission = { roleId: 'role-1', permissionId: 'perm-1' };
        (mockPrisma as any).rolePermission.create.mockResolvedValue(mockRolePermission);

        const result = await service.assignPermission('role-1', 'perm-1');

        expect(result).toEqual(mockRolePermission);
      });
    });

    describe('assignRoleToUser', () => {
      it('should assign role to user', async () => {
        const mockMember = { userId: 'user-1', companyId: 'company-1', roleId: 'role-1' };
        mockPrisma.companyMember.update.mockResolvedValue(mockMember);

        const result = await service.assignRoleToUser('user-1', 'company-1', 'role-1');

        expect(result.roleId).toBe('role-1');
      });
    });

    describe('seedDefaultPermissions', () => {
      it('should seed default permissions', async () => {
        (mockPrisma as any).permission.upsert.mockResolvedValue({});

        await service.seedDefaultPermissions();

        // 18 default permissions
        expect((mockPrisma as any).permission.upsert).toHaveBeenCalledTimes(18);
      });
    });
  });
});
