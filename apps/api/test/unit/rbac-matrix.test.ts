import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Context } from '@src/trpc/context';
import { adminRouter } from '@src/trpc/routers/admin.router';
import { apiKeyRouter } from '@src/trpc/routers/api-key.router';
import { companyRouter } from '@src/trpc/routers/company.router';
import { integrationRouter } from '@src/trpc/routers/integration.router';
import { botRouter } from '@src/trpc/routers/bot.router';
import { CompanyService } from '@modules/company/company.service';
import { AdminService } from '@modules/admin/service';
import { mockPrisma, resetMocks } from './mocks/prisma.mock';
import {
  canIssueApiKeyPermission,
  canSessionPerformCapability,
  getActorApiKeyPermissions,
  getInvalidApiKeyPermissions,
} from '@modules/auth/rbac.policy';

const baseContext = (
  overrides: Partial<Context> = {}
): Context => ({
  req: { headers: {} } as Context['req'],
  res: {} as Context['res'],
  userId: 'rbac-actor',
  companyId: 'rbac-company-a',
  correlationId: 'rbac-matrix',
  idempotencyKey: undefined,
  businessShape: undefined,
  userRole: 'MEMBER',
  userPermissions: [],
  integrationId: undefined,
  isApiKeyAuth: false,
  permissions: undefined,
  apiKeyId: undefined,
  ...overrides,
});

describe('RBAC authorization matrix', () => {
  beforeEach(() => {
    resetMocks();
  });

  it.each([
    ['MEMBER', [], false],
    ['ADMIN', [], true],
    ['OWNER', [], true],
    ['ADMINISTRATOR', ['COMPANY:UPDATE', 'RENTAL:UPDATE'], true],
    [undefined, ['COMPANY:UPDATE'], false],
  ])(
    'applies deny-by-default session matrix for admin capability: %s',
    (role, permissions, allowed) => {
      expect(
        canSessionPerformCapability(
          role,
          permissions,
          'admin'
        )
      ).toBe(allowed);
    }
  );

  it('returns FORBIDDEN for ordinary and missing-role admin callers', async () => {
    for (const userRole of ['MEMBER', undefined]) {
      const caller = adminRouter.createCaller(
        baseContext({ userRole })
      );

      await expect(
        caller.getSagaLogs({ limit: 20, offset: 0 })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
  });

  it('denies ordinary members across each privileged tRPC surface', async () => {
    const member = baseContext({ userRole: 'MEMBER' });

    await expect(
      apiKeyRouter.createCaller(member).list()
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      integrationRouter.createCaller(member).install({
        appId: 'custom-storefront',
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      companyRouter
        .createCaller(
          baseContext({
            companyId: '00000000-0000-0000-0000-000000000001',
          })
        )
        .updateMemberRole({
          companyId: '00000000-0000-0000-0000-000000000001',
          userId: '00000000-0000-0000-0000-000000000002',
          roleId: 'member-role',
        })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('fails closed when membership has no role on each privileged gate', async () => {
    const companyId = '00000000-0000-0000-0000-000000000001';
    const missingRole = baseContext({
      companyId,
      userRole: undefined,
      userPermissions: ['COMPANY:UPDATE', 'RENTAL:UPDATE', 'USERS:UPDATE'],
    });

    await expect(
      adminRouter.createCaller(missingRole).getSagaLogs({ limit: 20, offset: 0 })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      apiKeyRouter.createCaller(missingRole).list()
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      integrationRouter.createCaller(missingRole).list()
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      companyRouter.createCaller(missingRole).updateMemberRole({
        companyId,
        userId: '00000000-0000-0000-0000-000000000002',
        roleId: 'role',
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      botRouter.createCaller(missingRole).getStatus()
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects a privileged role change whose target company differs from context', async () => {
    const caller = companyRouter.createCaller(
      baseContext({
        companyId: '00000000-0000-0000-0000-000000000001',
        userRole: 'ADMIN',
      })
    );

    await expect(
      caller.updateMemberRole({
        companyId: '00000000-0000-0000-0000-000000000002',
        userId: '00000000-0000-0000-0000-000000000003',
        roleId: 'role',
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mockPrisma.companyMember.update).not.toHaveBeenCalled();
  });

  it.each(['ADMIN', 'OWNER', 'ADMINISTRATOR'])(
    'allows trusted privileged role %s through the admin gate',
    async (userRole) => {
      const getSagaLogs = vi
        .spyOn(AdminService.prototype, 'getSagaLogs')
        .mockResolvedValue({
          data: [],
          pagination: { total: 0, limit: 20, offset: 0 },
        });

      const result = await adminRouter
        .createCaller(baseContext({ userRole }))
        .getSagaLogs({ limit: 20, offset: 0 });

      expect(result.pagination.total).toBe(0);
      expect(getSagaLogs).toHaveBeenCalledWith({
        companyId: 'rbac-company-a',
        limit: 20,
        offset: 0,
        step: undefined,
      });
      getSagaLogs.mockRestore();
    }
  );

  it.each([
    'admin',
    'replay',
    'apiKeyManagement',
    'integrationManagement',
    'roleManagement',
  ] as const)(
    'does not treat generic CRUD permission as a %s grant',
    (capability) => {
      expect(
        canSessionPerformCapability(
          'OPERATIONS_MANAGER',
          ['COMPANY:UPDATE', 'RENTAL:UPDATE', 'USERS:UPDATE'],
          capability
        )
      ).toBe(false);
    }
  );

  it('denies every privileged endpoint to a non-admin with generic CRUD permissions', async () => {
    const companyId = '00000000-0000-0000-0000-000000000001';
    const genericCrudCaller = baseContext({
      companyId,
      userRole: 'OPERATIONS_MANAGER',
      userPermissions: ['COMPANY:UPDATE', 'RENTAL:UPDATE', 'USERS:UPDATE'],
    });

    const endpoints: Array<[string, () => Promise<unknown>]> = [
      ['admin.getSagaLogs', () => adminRouter.createCaller(genericCrudCaller).getSagaLogs({ limit: 20, offset: 0 })],
      ['admin.getOrphanJournals', () => adminRouter.createCaller(genericCrudCaller).getOrphanJournals({ limit: 20, offset: 0 })],
      ['admin.getRentalWebhookOutboxStats', () => adminRouter.createCaller(genericCrudCaller).getRentalWebhookOutboxStats()],
      ['admin.listRentalWebhookOutbox', () => adminRouter.createCaller(genericCrudCaller).listRentalWebhookOutbox({ limit: 20, offset: 0 })],
      ['admin.getRentalWebhookOutboxDetail', () => adminRouter.createCaller(genericCrudCaller).getRentalWebhookOutboxDetail({ id: 'delivery' })],
      ['admin.replayRentalWebhookOutbox', () => adminRouter.createCaller(genericCrudCaller).replayRentalWebhookOutbox({ id: 'delivery' })],
      ['admin.replayRentalWebhookOutboxBulk', () => adminRouter.createCaller(genericCrudCaller).replayRentalWebhookOutboxBulk({ limit: 1 })],
      ['admin.getTenantWebhookOutboxStats', () => adminRouter.createCaller(genericCrudCaller).getTenantWebhookOutboxStats()],
      ['admin.listTenantWebhookOutbox', () => adminRouter.createCaller(genericCrudCaller).listTenantWebhookOutbox({ limit: 20, offset: 0 })],
      ['admin.getTenantWebhookOutboxDetail', () => adminRouter.createCaller(genericCrudCaller).getTenantWebhookOutboxDetail({ id: 'delivery' })],
      ['admin.replayTenantWebhookOutbox', () => adminRouter.createCaller(genericCrudCaller).replayTenantWebhookOutbox({ id: 'delivery' })],
      ['admin.replayTenantWebhookOutboxBulk', () => adminRouter.createCaller(genericCrudCaller).replayTenantWebhookOutboxBulk({ limit: 1 })],
      ['apiKey.list', () => apiKeyRouter.createCaller(genericCrudCaller).list()],
      ['apiKey.create', () => apiKeyRouter.createCaller(genericCrudCaller).create({ name: 'key' })],
      ['apiKey.revoke', () => apiKeyRouter.createCaller(genericCrudCaller).revoke({ keyId: 'key' })],
      ['apiKey.updateWebhook', () => apiKeyRouter.createCaller(genericCrudCaller).updateWebhook({ keyId: 'key', webhookUrl: null })],
      ['apiKey.update', () => apiKeyRouter.createCaller(genericCrudCaller).update({ keyId: 'key', name: 'key' })],
      ['apiKey.testWebhook', () => apiKeyRouter.createCaller(genericCrudCaller).testWebhook({ webhookUrl: 'https://example.test' })],
      ['apiKey.getStats', () => apiKeyRouter.createCaller(genericCrudCaller).getStats()],
      ['integration.list', () => integrationRouter.createCaller(genericCrudCaller).list()],
      ['integration.install', () => integrationRouter.createCaller(genericCrudCaller).install({ appId: 'custom-storefront' })],
      ['integration.createCustom', () => integrationRouter.createCaller(genericCrudCaller).createCustom({ name: 'Custom' })],
      ['integration.get', () => integrationRouter.createCaller(genericCrudCaller).get({ id: 'integration' })],
      ['integration.update', () => integrationRouter.createCaller(genericCrudCaller).update({ id: 'integration', isActive: false, config: {} })],
      ['integration.rotateKey', () => integrationRouter.createCaller(genericCrudCaller).rotateKey({ integrationId: 'integration' })],
      ['company.updateMemberRole', () => companyRouter.createCaller(genericCrudCaller).updateMemberRole({ companyId, userId: '00000000-0000-0000-0000-000000000002', roleId: 'role' })],
      ['bot.getStatus', () => botRouter.createCaller(genericCrudCaller).getStatus()],
      ['bot.ping', () => botRouter.createCaller(genericCrudCaller).ping()],
      ['bot.logout', () => botRouter.createCaller(genericCrudCaller).logout()],
    ];

    for (const [name, invoke] of endpoints) {
      await expect(invoke(), name).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
  });

  it('does not allow an API-key write scope to exceed catalog authority', () => {
    const limitedRole = 'INTEGRATION_MANAGER';
    const limitedPermissions = [
      'RENTAL:CREATE',
      'RENTAL:UPDATE',
      'RENTAL:APPROVE',
    ];

    expect(
      canIssueApiKeyPermission(
        limitedRole,
        limitedPermissions,
        'rental:read'
      )
    ).toBe(false);
    expect(
      canIssueApiKeyPermission(
        limitedRole,
        limitedPermissions,
        'rental:write'
      )
    ).toBe(false);
    expect(
      getActorApiKeyPermissions(limitedRole, limitedPermissions)
    ).toEqual([]);
    expect(getInvalidApiKeyPermissions(['rental:read', 'admin:*'])).toEqual([
      'admin:*',
    ]);
  });

  it('allows only the catalog scopes held by a non-privileged actor', () => {
    const permissions = [
      'RENTAL:READ',
      'RENTAL:CREATE',
      'RENTAL:UPDATE',
      'RENTAL:DELETE',
      'RENTAL:APPROVE',
    ];

    expect(
      getActorApiKeyPermissions('INTEGRATION_MANAGER', permissions)
    ).toEqual(['rental:read', 'rental:write']);
  });

  it('rejects a role id from another company before mutation', async () => {
    const service = new CompanyService();
    mockPrisma.companyMember.findUnique
      .mockResolvedValueOnce({
        role: { name: 'ADMIN', permissions: [] },
      })
      .mockResolvedValueOnce({
        userId: 'rbac-target',
        role: { name: 'MEMBER' },
      });
    mockPrisma.role.findFirst.mockResolvedValue(null);

    await expect(
      service.updateMemberRole(
        'rbac-company-a',
        'rbac-target',
        'foreign-role',
        'rbac-actor'
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mockPrisma.companyMember.update).not.toHaveBeenCalled();
  });

  it('does not let a delegated role manager mint an administrative role', async () => {
    const service = new CompanyService();
    mockPrisma.companyMember.findUnique
      .mockResolvedValueOnce({
        role: {
          name: 'OPERATIONS_MANAGER',
          permissions: [
            { permission: { module: 'USERS', action: 'UPDATE' } },
          ],
        },
      })
      .mockResolvedValueOnce({
        userId: 'rbac-target',
        role: { name: 'MEMBER' },
      });
    mockPrisma.role.findFirst.mockResolvedValue({
      id: 'owner-role',
      name: 'OWNER',
    });

    await expect(
      service.updateMemberRole(
        'rbac-company-a',
        'rbac-target',
        'owner-role',
        'rbac-actor'
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mockPrisma.companyMember.update).not.toHaveBeenCalled();
  });

  it('prevents self-demotion and removal of the last owner', async () => {
    const service = new CompanyService();

    mockPrisma.companyMember.findUnique
      .mockResolvedValueOnce({ role: { name: 'ADMIN', permissions: [] } })
      .mockResolvedValueOnce({
        userId: 'rbac-actor',
        role: { name: 'ADMIN' },
      });
    mockPrisma.role.findFirst.mockResolvedValue({
      id: 'member-role',
      name: 'MEMBER',
    });

    await expect(
      service.updateMemberRole(
        'rbac-company-a',
        'rbac-actor',
        'member-role',
        'rbac-actor'
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    resetMocks();
    mockPrisma.companyMember.findUnique
      .mockResolvedValueOnce({ role: { name: 'ADMIN', permissions: [] } })
      .mockResolvedValueOnce({
        userId: 'rbac-owner',
        role: { name: 'OWNER' },
      });
    mockPrisma.role.findFirst.mockResolvedValue({
      id: 'member-role',
      name: 'MEMBER',
    });
    mockPrisma.companyMember.findFirst.mockResolvedValue(null);

    await expect(
      service.updateMemberRole(
        'rbac-company-a',
        'rbac-owner',
        'member-role',
        'rbac-actor'
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('preserves a legitimate admin workflow when another owner remains', async () => {
    const service = new CompanyService();
    mockPrisma.companyMember.findUnique
      .mockResolvedValueOnce({ role: { name: 'ADMIN', permissions: [] } })
      .mockResolvedValueOnce({
        userId: 'rbac-owner-a',
        role: { name: 'OWNER' },
      });
    mockPrisma.role.findFirst.mockResolvedValue({
      id: 'admin-role',
      name: 'ADMIN',
    });
    mockPrisma.companyMember.findFirst.mockResolvedValue({
      userId: 'rbac-owner-b',
    });
    mockPrisma.companyMember.update.mockResolvedValue({
      userId: 'rbac-owner-a',
      companyId: 'rbac-company-a',
      roleId: 'admin-role',
    });

    await expect(
      service.updateMemberRole(
        'rbac-company-a',
        'rbac-owner-a',
        'admin-role',
        'rbac-actor'
      )
    ).resolves.toMatchObject({ roleId: 'admin-role' });
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' }
    );
  });
});
