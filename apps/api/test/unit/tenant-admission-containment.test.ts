import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import type { Prisma } from '@sync-erp/database';
import { BusinessShape, OrderType } from '@sync-erp/database';
import { createContext, type Context } from '@src/trpc/context';
import { healthRouter } from '@src/trpc/routers/health.router';
import { authRouter } from '@src/trpc/routers/auth.router';
import { userRouter } from '@src/trpc/routers/user.router';
import { companyRouter } from '@src/trpc/routers/company.router';
import { salesOrderRouter } from '@src/trpc/routers/salesOrder.router';
import { purchaseOrderRouter } from '@src/trpc/routers/purchaseOrder.router';
import { rentalBundleRouter } from '@src/trpc/routers/rental-bundle.router';
import { apiKeyService } from '@src/services/api-key.service';
import { redisRateLimitService } from '@src/modules/common/services/redis-rate-limit.service';
import * as bundleService from '@modules/rental/rental-bundle.service';
import { SalesOrderRepository } from '@modules/sales/sales-order.repository';
import { PurchaseOrderRepository } from '@modules/procurement/purchase-order.repository';
import { container, ServiceKeys } from '@src/modules/common/di';
import type { CompanyService } from '@modules/company/company.service';
import type { UserService } from '@modules/user/user.service';
import { mockPrisma } from './mocks/prisma.mock';
import { optionalAuthMiddleware } from '@src/middlewares/auth';
import type { AuthService } from '@modules/auth/auth.service';
import { apiKeyProcedure, router } from '@src/trpc/trpc';
import { adminRouter } from '@src/trpc/routers/admin.router';
import { AdminService } from '@modules/admin/service';

const COMPANY_A_ID = '00000000-0000-0000-0000-000000000001';
const COMPANY_B_ID = '00000000-0000-0000-0000-000000000002';
const USER_A_ID = '00000000-0000-0000-0000-000000000011';
const USER_B_ID = '00000000-0000-0000-0000-000000000012';
const ORDER_B_ID = '00000000-0000-0000-0000-000000000021';

const apiKeyContextProbe = router({
  inspect: apiKeyProcedure.query(({ ctx }) => ({
    userId: ctx.userId,
    userRole: ctx.userRole,
    userPermissions: ctx.userPermissions,
    isSessionAuth: ctx.isSessionAuth,
    sessionTenantAdmission: ctx.sessionTenantAdmission,
    businessShape: ctx.businessShape,
    companyId: ctx.companyId,
    permissions: ctx.permissions,
    isApiKeyAuth: ctx.isApiKeyAuth,
  })),
});

function buildContext(
  overrides: Partial<Context> = {}
): Context {
  return {
    req: { headers: {} } as Context['req'],
    res: {} as Context['res'],
    userId: USER_A_ID,
    companyId: COMPANY_A_ID,
    correlationId: 'tenant-admission-containment-test',
    idempotencyKey: undefined,
    integrationId: undefined,
    isApiKeyAuth: false,
    businessShape: BusinessShape.RETAIL,
    userRole: 'ADMIN',
    userPermissions: ['*:*'],
    permissions: undefined,
    apiKeyId: undefined,
    ...overrides,
  };
}

function buildRequestContext(
  context: Record<string, unknown>
) {
  return {
    req: {
      headers: {},
      context,
    } as never,
    res: {} as never,
    info: {} as never,
  };
}

describe('tenant admission and direct lookup containment', () => {
  let companyService: CompanyService;
  let userService: UserService;
  let authService: AuthService;

  beforeEach(() => {
    companyService = container.resolve<CompanyService>(
      ServiceKeys.COMPANY_SERVICE
    );
    userService = container.resolve<UserService>(ServiceKeys.USER_SERVICE);
    authService = container.resolve<AuthService>(ServiceKeys.AUTH_SERVICE);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marks a session with no membership as denied and withholds tenant-derived context', async () => {
    mockPrisma.company.findUnique.mockResolvedValue({
      businessShape: BusinessShape.RETAIL,
    });
    mockPrisma.companyMember.findUnique.mockResolvedValue(null);

    const context = await createContext(
      buildRequestContext({
        userId: USER_A_ID,
        companyId: COMPANY_B_ID,
        isSessionAuth: true,
      })
    );

    expect(context.sessionTenantAdmission).toBe('denied');
    expect(context.businessShape).toBeUndefined();
    expect(context.userRole).toBeUndefined();
    expect(context.userPermissions).toEqual([]);
  });

  it('uses session provenance from middleware and rejects a foreign company header', async () => {
    mockPrisma.session.findUnique.mockResolvedValue({
      userId: USER_A_ID,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: USER_A_ID },
    });
    mockPrisma.company.findUnique.mockResolvedValue({
      businessShape: BusinessShape.RETAIL,
    });
    mockPrisma.companyMember.findUnique.mockResolvedValue(null);

    const req = {
      cookies: { sessionId: 'valid-session' },
      headers: {
        'x-company-id': COMPANY_B_ID,
        'x-session-auth': 'true',
        'x-api-key': 'spoofed-header-value',
      },
    } as unknown as Request;
    const next = vi.fn();

    await optionalAuthMiddleware(req, {} as never, next);

    expect(req.context).toMatchObject({
      userId: USER_A_ID,
      companyId: COMPANY_B_ID,
      isSessionAuth: true,
    });
    expect(next).toHaveBeenCalledOnce();

    const context = await createContext({
      req,
      res: {} as never,
    } as never);

    expect(context.isApiKeyAuth).toBe(false);
    expect(context.sessionTenantAdmission).toBe('denied');

    const caller = userRouter.createCaller(context);
    await expect(caller.listByCompany()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'User does not belong to this company',
    });
  });

  it('fails closed for a session whose admission marker is missing', async () => {
    const caller = userRouter.createCaller(
      buildContext({
        isSessionAuth: true,
        sessionTenantAdmission: undefined,
      })
    );

    await expect(caller.listByCompany()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'User does not belong to this company',
    });

    const explicitlyDeniedCaller = userRouter.createCaller(
      buildContext({
        sessionTenantAdmission: 'denied',
      })
    );

    await expect(explicitlyDeniedCaller.listByCompany()).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'User does not belong to this company',
    });
  });

  it('uses admitted membership-derived role in the real app router and rejects generic CRUD escalation', async () => {
    mockPrisma.company.findUnique.mockResolvedValue({
      businessShape: BusinessShape.RETAIL,
    });
    mockPrisma.companyMember.findUnique.mockResolvedValue({
      role: {
        name: 'Administrator',
        permissions: [
          { permission: { module: 'COMPANY', action: 'UPDATE' } },
          { permission: { module: 'RENTAL', action: 'UPDATE' } },
        ],
      },
    });

    const getSagaLogs = vi
      .spyOn(AdminService.prototype, 'getSagaLogs')
      .mockResolvedValue({
        data: [],
        pagination: { total: 0, limit: 20, offset: 0 },
      });

    const administratorContext = await createContext(
      buildRequestContext({
        userId: USER_A_ID,
        companyId: COMPANY_A_ID,
        isSessionAuth: true,
      })
    );

    expect(administratorContext).toMatchObject({
      userId: USER_A_ID,
      companyId: COMPANY_A_ID,
      userRole: 'Administrator',
      userPermissions: ['COMPANY:UPDATE', 'RENTAL:UPDATE'],
      businessShape: BusinessShape.RETAIL,
      sessionTenantAdmission: 'admitted',
    });

    await expect(
      adminRouter.createCaller(administratorContext).getSagaLogs({
        limit: 20,
        offset: 0,
      })
    ).resolves.toMatchObject({ pagination: { total: 0 } });

    mockPrisma.companyMember.findUnique.mockResolvedValue({
      role: {
        name: 'OPERATIONS_MANAGER',
        permissions: [
          { permission: { module: 'COMPANY', action: 'UPDATE' } },
          { permission: { module: 'RENTAL', action: 'UPDATE' } },
          { permission: { module: 'USERS', action: 'UPDATE' } },
        ],
      },
    });

    const genericContext = await createContext(
      buildRequestContext({
        userId: USER_A_ID,
        companyId: COMPANY_A_ID,
        isSessionAuth: true,
      })
    );

    await expect(
      adminRouter.createCaller(genericContext).getSagaLogs({
        limit: 20,
        offset: 0,
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(getSagaLogs).toHaveBeenCalledOnce();
  });

  it('leaves public procedures independent of session tenant admission', async () => {
    const caller = healthRouter.createCaller(
      buildContext({
        isSessionAuth: true,
        sessionTenantAdmission: 'denied',
      })
    );

    await expect(caller.check()).resolves.toMatchObject({ status: 'healthy' });
  });

  it('keeps auth-only procedures independent of selected-company admission', async () => {
    const getProfile = vi
      .spyOn(authService, 'getProfile')
      .mockResolvedValue(null);
    const caller = authRouter.createCaller(
      buildContext({
        isSessionAuth: true,
        sessionTenantAdmission: 'denied',
      })
    );

    await expect(caller.me()).resolves.toBeNull();
    expect(getProfile).toHaveBeenCalledWith(USER_A_ID);
  });

  it('leaves API-key procedures independent of a concurrent session admission failure', async () => {
    vi.spyOn(apiKeyService, 'validateKey').mockResolvedValue({
      companyId: COMPANY_A_ID,
      permissions: ['rental:read'],
      keyId: 'tenant-admission-api-key',
      rateLimit: 1000,
    });
    vi.spyOn(redisRateLimitService, 'consume').mockResolvedValue({
      allowed: true,
      remaining: 999,
      retryAfterSeconds: 0,
    });
    const findByExternalId = vi
      .spyOn(bundleService, 'findByExternalId')
      .mockResolvedValue(null);

    const caller = rentalBundleRouter.createCaller(
      buildContext({
        req: {
          headers: { authorization: 'Bearer tenant-admission-api-key' },
        } as Context['req'],
        isSessionAuth: true,
        sessionTenantAdmission: 'denied',
      })
    );

    await expect(
      caller.findByExternalId({ externalId: 'foreign-safe-lookup' })
    ).resolves.toBeNull();
    expect(findByExternalId).toHaveBeenCalledWith({
      companyId: COMPANY_A_ID,
      externalId: 'foreign-safe-lookup',
    });
  });

  it('separates validated API-key provenance from a concurrent session context', async () => {
    vi.spyOn(apiKeyService, 'validateKey').mockResolvedValue({
      companyId: COMPANY_B_ID,
      permissions: ['rental:read'],
      keyId: 'provenance-api-key',
      rateLimit: 1000,
    });
    vi.spyOn(redisRateLimitService, 'consume').mockResolvedValue({
      allowed: true,
      remaining: 999,
      retryAfterSeconds: 0,
    });

    const result = await apiKeyContextProbe
      .createCaller(
        buildContext({
          req: {
            headers: { authorization: 'Bearer provenance-api-key' },
          } as Context['req'],
          userId: USER_A_ID,
          companyId: COMPANY_A_ID,
          userRole: 'OWNER',
          userPermissions: ['*:*'],
          isSessionAuth: true,
          sessionTenantAdmission: 'admitted',
        })
      )
      .inspect();

    expect(result).toEqual({
      userId: undefined,
      userRole: undefined,
      userPermissions: [],
      isSessionAuth: false,
      sessionTenantAdmission: undefined,
      businessShape: undefined,
      companyId: COMPANY_B_ID,
      permissions: ['rental:read'],
      isApiKeyAuth: true,
    });
  });

  it('does not return a company outside the caller membership set', async () => {
    vi.spyOn(companyService, 'isMember').mockResolvedValue(false);
    const getById = vi
      .spyOn(companyService, 'getById')
      .mockResolvedValue(null);

    const caller = companyRouter.createCaller(
      buildContext({ sessionTenantAdmission: 'admitted' })
    );

    await expect(caller.getById({ id: COMPANY_B_ID })).resolves.toBeNull();
    expect(companyService.isMember).toHaveBeenCalledWith(
      USER_A_ID,
      COMPANY_B_ID
    );
    expect(getById).not.toHaveBeenCalled();
  });

  it('does not return a user outside the selected company membership set', async () => {
    mockPrisma.companyMember.findUnique.mockResolvedValue(null);
    const getById = vi.spyOn(userService, 'getById').mockResolvedValue(null);

    const caller = userRouter.createCaller(
      buildContext({ sessionTenantAdmission: 'admitted' })
    );

    await expect(caller.getById({ id: USER_B_ID })).resolves.toBeNull();
    expect(mockPrisma.companyMember.findUnique).toHaveBeenCalledWith({
      where: {
        userId_companyId: {
          userId: USER_B_ID,
          companyId: COMPANY_A_ID,
        },
      },
      select: { userId: true },
    });
    expect(getById).not.toHaveBeenCalled();
  });

  it('binds quantity router calls to the admitted company, never the order UUID tenant', async () => {
    const salesQuantities = vi
      .spyOn(
        container.resolve(ServiceKeys.SALES_ORDER_SERVICE) as {
          getShippedQuantities: (
            orderId: string,
            companyId: string
          ) => Promise<Map<string, number>>;
        },
        'getShippedQuantities'
      )
      .mockResolvedValue(new Map());
    const purchaseQuantities = vi
      .spyOn(
        container.resolve(ServiceKeys.PURCHASE_ORDER_SERVICE) as {
          getReceivedQuantities: (
            orderId: string,
            companyId: string
          ) => Promise<Map<string, number>>;
        },
        'getReceivedQuantities'
      )
      .mockResolvedValue(new Map());

    const salesCaller = salesOrderRouter.createCaller(
      buildContext({ sessionTenantAdmission: 'admitted' })
    );
    const purchaseCaller = purchaseOrderRouter.createCaller(
      buildContext({ sessionTenantAdmission: 'admitted' })
    );

    await expect(
      salesCaller.getShippedQuantities({ orderId: ORDER_B_ID })
    ).resolves.toEqual([]);
    await expect(
      purchaseCaller.getReceivedQuantities({ orderId: ORDER_B_ID })
    ).resolves.toEqual([]);

    expect(salesQuantities).toHaveBeenCalledWith(ORDER_B_ID, COMPANY_A_ID);
    expect(purchaseQuantities).toHaveBeenCalledWith(
      ORDER_B_ID,
      COMPANY_A_ID
    );
  });

  it('rejects a foreign sales order before reading shipped fulfillment items', async () => {
    const findOrder = vi.fn().mockResolvedValue(null);
    const findItems = vi.fn();
    const tx = {
      order: { findFirst: findOrder },
      fulfillmentItem: { findMany: findItems },
    } as unknown as Prisma.TransactionClient;

    const result = await new SalesOrderRepository().getShippedQuantities(
      ORDER_B_ID,
      COMPANY_A_ID,
      tx
    );

    expect(result).toEqual(new Map());
    expect(findOrder).toHaveBeenCalledWith({
      where: {
        id: ORDER_B_ID,
        companyId: COMPANY_A_ID,
        type: OrderType.SALES,
      },
      select: { companyId: true },
    });
    expect(findItems).not.toHaveBeenCalled();
  });

  it('rejects a foreign purchase order before reading receipt fulfillment items', async () => {
    const findOrder = vi.fn().mockResolvedValue(null);
    const findItems = vi.fn();
    const tx = {
      order: { findFirst: findOrder },
      fulfillmentItem: { findMany: findItems },
    } as unknown as Prisma.TransactionClient;

    const result = await new PurchaseOrderRepository().getReceivedQuantities(
      ORDER_B_ID,
      COMPANY_A_ID,
      tx
    );

    expect(result).toEqual(new Map());
    expect(findOrder).toHaveBeenCalledWith({
      where: {
        id: ORDER_B_ID,
        companyId: COMPANY_A_ID,
        type: OrderType.PURCHASE,
      },
      select: { companyId: true },
    });
    expect(findItems).not.toHaveBeenCalled();
  });

});
