import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Express } from 'express';
import express from 'express';
import cookieParser from 'cookie-parser';
import * as trpcExpress from '@trpc/server/adapters/express';
import request from 'supertest';
import { BusinessShape } from '@sync-erp/database';
import { createContext } from '@src/trpc/context';
import { router } from '@src/trpc/trpc';
import { adminRouter } from '@src/trpc/routers/admin.router';
import { rentalBundleRouter } from '@src/trpc/routers/rental-bundle.router';
import { optionalAuthMiddleware } from '@src/middlewares/auth';
import { apiKeyService } from '@src/services/api-key.service';
import { redisRateLimitService } from '@src/modules/common/services/redis-rate-limit.service';
import { AdminService } from '@src/modules/admin/service';
import * as bundleService from '@src/modules/rental/rental-bundle.service';
import { mockPrisma } from './mocks/prisma.mock';

const COMPANY_ID = '00000000-0000-0000-0000-000000000501';
const API_KEY_COMPANY_ID = '00000000-0000-0000-0000-000000000502';
const USER_ID = '00000000-0000-0000-0000-000000000503';

const httpRouter = router({
  admin: adminRouter,
  rentalBundle: rentalBundleRouter,
});

function trpcInput(input: unknown): string {
  return JSON.stringify({ json: input });
}

describe('RBAC HTTP tRPC admission', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use(cookieParser());
    app.use(
      '/api/trpc',
      optionalAuthMiddleware,
      trpcExpress.createExpressMiddleware({
        router: httpRouter,
        createContext,
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function admitSession(role: string | null, permissions: Array<{ module: string; action: string }> = []) {
    mockPrisma.session.findUnique.mockResolvedValue({
      userId: USER_ID,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: USER_ID },
    });
    mockPrisma.company.findUnique.mockResolvedValue({
      businessShape: BusinessShape.RETAIL,
    });
    mockPrisma.companyMember.findUnique.mockResolvedValue({
      role: role
        ? {
            name: role,
            permissions: permissions.map((permission) => ({ permission })),
          }
        : null,
    });
  }

  function adminRequest() {
    return request(app)
      .get('/api/trpc/admin.getSagaLogs')
      .query({ input: trpcInput({ limit: 1, offset: 0 }) })
      .set('Cookie', ['sessionId=http-session'])
      .set('x-company-id', COMPANY_ID);
  }

  it('admits an Administrator from the actual cookie/session and company-header path', async () => {
    admitSession('Administrator', [
      { module: 'COMPANY', action: 'UPDATE' },
    ]);
    const getSagaLogs = vi
      .spyOn(AdminService.prototype, 'getSagaLogs')
      .mockResolvedValue({
        data: [],
        pagination: { total: 0, limit: 1, offset: 0 },
      });

    const response = await adminRequest();

    expect(response.status).toBe(200);
    expect(getSagaLogs).toHaveBeenCalledWith({
      companyId: COMPANY_ID,
      limit: 1,
      offset: 0,
      step: undefined,
    });
  });

  it('fails closed at HTTP level when the admitted membership has no role', async () => {
    admitSession(null);
    const getSagaLogs = vi.spyOn(AdminService.prototype, 'getSagaLogs');

    const response = await adminRequest();

    expect(response.status).toBe(403);
    expect(getSagaLogs).not.toHaveBeenCalled();
  });

  it('does not escalate generic CRUD permissions through the HTTP context', async () => {
    admitSession('OPERATIONS_MANAGER', [
      { module: 'COMPANY', action: 'UPDATE' },
      { module: 'USERS', action: 'UPDATE' },
      { module: 'RENTAL', action: 'UPDATE' },
    ]);
    const getSagaLogs = vi.spyOn(AdminService.prototype, 'getSagaLogs');

    const response = await adminRequest();

    expect(response.status).toBe(403);
    expect(getSagaLogs).not.toHaveBeenCalled();
  });

  it('admits a validated Bearer API key through Express and replaces caller-selected tenant state', async () => {
    vi.spyOn(apiKeyService, 'validateKey').mockResolvedValue({
      companyId: API_KEY_COMPANY_ID,
      permissions: ['rental:read'],
      keyId: 'http-api-key',
      rateLimit: 100,
    });
    vi.spyOn(redisRateLimitService, 'consume').mockResolvedValue({
      allowed: true,
      remaining: 99,
      retryAfterSeconds: 0,
    });
    const findByExternalId = vi
      .spyOn(bundleService, 'findByExternalId')
      .mockResolvedValue(null);

    const response = await request(app)
      .get('/api/trpc/rentalBundle.findByExternalId')
      .query({ input: trpcInput({ externalId: 'http-runtime-bundle' }) })
      .set('Authorization', 'Bearer validated-http-api-key')
      .set('x-company-id', COMPANY_ID);

    expect(response.status).toBe(200);
    expect(apiKeyService.validateKey).toHaveBeenCalledWith(
      'validated-http-api-key'
    );
    expect(findByExternalId).toHaveBeenCalledWith({
      companyId: API_KEY_COMPANY_ID,
      externalId: 'http-runtime-bundle',
    });
  });

  it('rejects spoofed API-key and session provenance headers at HTTP level', async () => {
    const apiKeyResponse = await request(app)
      .get('/api/trpc/rentalBundle.findByExternalId')
      .query({ input: trpcInput({ externalId: 'spoofed-runtime-bundle' }) })
      .set('x-api-key', 'spoofed-key')
      .set('x-api-key-auth', 'true')
      .set('x-company-id', COMPANY_ID);

    const sessionResponse = await request(app)
      .get('/api/trpc/admin.getSagaLogs')
      .query({ input: trpcInput({ limit: 1, offset: 0 }) })
      .set('x-session-auth', 'true')
      .set('x-company-id', COMPANY_ID);

    expect(apiKeyResponse.status).toBe(401);
    expect(sessionResponse.status).toBe(401);
  });
});
