import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CompanyService } from '@src/modules/company/company.service';
import { prisma } from '@sync-erp/database';

const DATABASE_NAME = 'sync-erp-test';
const COMPANY_ID = '00000000-0000-0000-0000-000000000301';
const ADMIN_ID = '00000000-0000-0000-0000-000000000302';
const OWNER_A_ID = '00000000-0000-0000-0000-000000000303';
const OWNER_B_ID = '00000000-0000-0000-0000-000000000304';
const OWNER_ROLE_ID = '00000000-0000-0000-0000-000000000305';
const ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000306';
const MEMBER_ROLE_ID = '00000000-0000-0000-0000-000000000307';

const databaseUrl = process.env.DATABASE_URL ?? '';
let isDisposableLocalDatabase = false;
try {
  const parsed = new URL(databaseUrl);
  const databaseName = decodeURIComponent(parsed.pathname.slice(1));
  const localHost =
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '::1';
  isDisposableLocalDatabase =
    localHost &&
    databaseName === DATABASE_NAME &&
    process.env.RBAC_ATOMICITY_ALLOW_MUTATION === '1';
} catch {
  isDisposableLocalDatabase = false;
}

const describeSafe = isDisposableLocalDatabase ? describe : describe.skip;

describeSafe('company role DB atomicity (disposable local DB only)', () => {
  const service = new CompanyService();

  beforeAll(async () => {
    const identity = await prisma.$queryRaw<
      Array<{ database: string; serverAddress: string | null }>
    >`SELECT current_database() AS database, inet_server_addr()::text AS "serverAddress"`;

    expect(identity[0]?.database).toBe(DATABASE_NAME);
    expect(
      identity[0]?.serverAddress === null ||
        identity[0]?.serverAddress?.startsWith('127.0.0.1') ||
        identity[0]?.serverAddress?.startsWith('::1')
    ).toBe(true);

    await prisma.companyMember.deleteMany({ where: { companyId: COMPANY_ID } });
    await prisma.role.deleteMany({ where: { companyId: COMPANY_ID } });
    await prisma.company.deleteMany({ where: { id: COMPANY_ID } });
    await prisma.user.deleteMany({
      where: { id: { in: [ADMIN_ID, OWNER_A_ID, OWNER_B_ID] } },
    });

    await prisma.company.create({
      data: { id: COMPANY_ID, name: 'RBAC atomicity test company' },
    });
    await prisma.user.createMany({
      data: [
        { id: ADMIN_ID, email: 'rbac-atomicity-admin@test.invalid', name: 'RBAC Admin', passwordHash: 'test-hash' },
        { id: OWNER_A_ID, email: 'rbac-atomicity-owner-a@test.invalid', name: 'RBAC Owner A', passwordHash: 'test-hash' },
        { id: OWNER_B_ID, email: 'rbac-atomicity-owner-b@test.invalid', name: 'RBAC Owner B', passwordHash: 'test-hash' },
      ],
    });
    await prisma.role.createMany({
      data: [
        { id: OWNER_ROLE_ID, companyId: COMPANY_ID, name: 'Owner' },
        { id: ADMIN_ROLE_ID, companyId: COMPANY_ID, name: 'Administrator' },
        { id: MEMBER_ROLE_ID, companyId: COMPANY_ID, name: 'Member' },
      ],
    });
  });

  beforeEach(async () => {
    await prisma.companyMember.deleteMany({ where: { companyId: COMPANY_ID } });
    await prisma.companyMember.createMany({
      data: [
        { userId: ADMIN_ID, companyId: COMPANY_ID, roleId: ADMIN_ROLE_ID },
        { userId: OWNER_A_ID, companyId: COMPANY_ID, roleId: OWNER_ROLE_ID },
        { userId: OWNER_B_ID, companyId: COMPANY_ID, roleId: OWNER_ROLE_ID },
      ],
    });
  });

  afterAll(async () => {
    await prisma.companyMember.deleteMany({ where: { companyId: COMPANY_ID } });
    await prisma.role.deleteMany({ where: { companyId: COMPANY_ID } });
    await prisma.company.deleteMany({ where: { id: COMPANY_ID } });
    await prisma.user.deleteMany({
      where: { id: { in: [ADMIN_ID, OWNER_A_ID, OWNER_B_ID] } },
    });
  });

  it('allows only one of two concurrent owner demotions to remove the final owner', async () => {
    const results = await Promise.allSettled([
      service.updateMemberRole(COMPANY_ID, OWNER_A_ID, MEMBER_ROLE_ID, ADMIN_ID),
      service.updateMemberRole(COMPANY_ID, OWNER_B_ID, MEMBER_ROLE_ID, ADMIN_ID),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);

    const owners = await prisma.companyMember.findMany({
      where: { companyId: COMPANY_ID },
      include: { role: true },
    });
    expect(
      owners.filter((member) => member.role?.name.toUpperCase() === 'OWNER')
    ).toHaveLength(1);
  });

  it('allows only one of two concurrent owner removals to remove the final owner', async () => {
    const results = await Promise.allSettled([
      service.removeMember(COMPANY_ID, OWNER_A_ID, ADMIN_ID),
      service.removeMember(COMPANY_ID, OWNER_B_ID, ADMIN_ID),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);

    const owners = await prisma.companyMember.findMany({
      where: { companyId: COMPANY_ID },
      include: { role: true },
    });
    expect(
      owners.filter((member) => member.role?.name.toUpperCase() === 'OWNER')
    ).toHaveLength(1);
  });
});
