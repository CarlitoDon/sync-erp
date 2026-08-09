import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { BusinessShape } from '@sync-erp/database';
import { createContext, type Context } from '@src/trpc/context';
import { optionalAuthMiddleware } from '@src/middlewares/auth';
import { apiKeyService } from '@src/services/api-key.service';
import { redisRateLimitService } from '@src/modules/common/services/redis-rate-limit.service';
import { apiKeyProcedure, router } from '@src/trpc/trpc';
import { adminRouter } from '@src/trpc/routers/admin.router';
import { AdminService } from '@src/modules/admin/service';
import { mockPrisma } from './mocks/prisma.mock';

const COMPANY_ID = '00000000-0000-0000-0000-000000000101';
const USER_ID = '00000000-0000-0000-0000-000000000102';

const apiKeyProbe = router({
  inspect: apiKeyProcedure.query(({ ctx }) => ({
    userId: ctx.userId,
    userRole: ctx.userRole,
    userPermissions: ctx.userPermissions,
    companyId: ctx.companyId,
    permissions: ctx.permissions,
    isSessionAuth: ctx.isSessionAuth,
    isApiKeyAuth: ctx.isApiKeyAuth,
    sessionTenantAdmission: ctx.sessionTenantAdmission,
  })),
});

function request(headers: Record<string, string>, cookies?: Record<string, string>) {
  return {
    headers,
    cookies: cookies ?? {},
    context: undefined,
  } as unknown as Request;
}

describe('RBAC runtime admission', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('derives the trusted session role and permissions only after middleware membership admission', async () => {
    mockPrisma.session.findUnique.mockResolvedValue({
      userId: USER_ID,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: USER_ID },
    });
    mockPrisma.company.findUnique.mockResolvedValue({
      businessShape: BusinessShape.RETAIL,
    });
    mockPrisma.companyMember.findUnique.mockResolvedValue({
      role: {
        name: 'Administrator',
        permissions: [
          { permission: { module: 'COMPANY', action: 'UPDATE' } },
        ],
      },
    });

    const req = request(
      { 'x-company-id': COMPANY_ID },
      { sessionId: 'runtime-session' }
    );
    const next = vi.fn();

    await optionalAuthMiddleware(req, {} as never, next);
    const context = await createContext({ req, res: {} as never } as never);

    expect(next).toHaveBeenCalledOnce();
    expect(context).toMatchObject({
      userId: USER_ID,
      companyId: COMPANY_ID,
      isSessionAuth: true,
      sessionTenantAdmission: 'admitted',
      userRole: 'Administrator',
      userPermissions: ['COMPANY:UPDATE'],
      businessShape: BusinessShape.RETAIL,
    });

    const getSagaLogs = vi
      .spyOn(AdminService.prototype, 'getSagaLogs')
      .mockResolvedValue({
        data: [],
        pagination: { total: 0, limit: 1, offset: 0 },
      });

    await expect(
      adminRouter.createCaller(context).getSagaLogs({ limit: 1, offset: 0 })
    ).resolves.toMatchObject({ pagination: { total: 0 } });
    expect(getSagaLogs).toHaveBeenCalledWith({
      companyId: COMPANY_ID,
      limit: 1,
      offset: 0,
      step: undefined,
    });
  });

  it('does not trust spoofed auth headers or incomplete session provenance', async () => {
    const req = request({
      'x-company-id': COMPANY_ID,
      'x-session-auth': 'true',
      'x-api-key': 'spoofed-key',
    });

    await optionalAuthMiddleware(req, {} as never, vi.fn());
    const context = await createContext({ req, res: {} as never } as never);

    expect(context).toMatchObject({
      userId: undefined,
      companyId: COMPANY_ID,
      isSessionAuth: false,
      isApiKeyAuth: false,
      permissions: undefined,
    });

    await expect(
      apiKeyProbe.createCaller(context).inspect()
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('admits only a validated Bearer API key and strips concurrent session identity', async () => {
    vi.spyOn(apiKeyService, 'validateKey').mockResolvedValue({
      companyId: COMPANY_ID,
      permissions: ['rental:read'],
      keyId: 'runtime-api-key',
      rateLimit: 100,
    });
    vi.spyOn(redisRateLimitService, 'consume').mockResolvedValue({
      allowed: true,
      remaining: 99,
      retryAfterSeconds: 0,
    });

    const req = request({
      'x-company-id': '00000000-0000-0000-0000-000000000999',
      authorization: 'Bearer runtime-api-key',
    });
    await optionalAuthMiddleware(req, {} as never, vi.fn());
    const context = await createContext({ req, res: {} as never } as never);

    const result = await apiKeyProbe.createCaller({
      ...context,
      userId: 'spoofed-session-user',
      userRole: 'OWNER',
      userPermissions: ['*:*'],
      isSessionAuth: true,
    } satisfies Context).inspect();

    expect(result).toEqual({
      userId: undefined,
      userRole: undefined,
      userPermissions: [],
      companyId: COMPANY_ID,
      permissions: ['rental:read'],
      isSessionAuth: false,
      isApiKeyAuth: true,
      sessionTenantAdmission: undefined,
    });
  });
});
