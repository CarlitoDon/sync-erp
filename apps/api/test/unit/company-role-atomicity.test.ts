import { beforeEach, describe, expect, it } from 'vitest';
import { CompanyService } from '@src/modules/company/company.service';
import { mockPrisma } from './mocks/prisma.mock';

const COMPANY_ID = '00000000-0000-0000-0000-000000000201';
const ACTOR_ID = '00000000-0000-0000-0000-000000000202';
const TARGET_ID = '00000000-0000-0000-0000-000000000203';

describe('company role mutation atomicity', () => {
  beforeEach(() => {
    mockPrisma.companyMember.findUnique
      .mockResolvedValueOnce({ role: { name: 'Administrator' } })
      .mockResolvedValueOnce({
        userId: TARGET_ID,
        role: { name: 'OWNER' },
      });
    mockPrisma.role.findFirst.mockResolvedValue({
      id: 'member-role',
      name: 'Member',
    });
    mockPrisma.companyMember.findFirst.mockResolvedValue({
      userId: 'another-owner',
    });
    mockPrisma.companyMember.update.mockResolvedValue({
      userId: TARGET_ID,
      companyId: COMPANY_ID,
      roleId: 'member-role',
    });
  });

  it('locks the company row before reading the owner set', async () => {
    const result = await new CompanyService().updateMemberRole(
      COMPANY_ID,
      TARGET_ID,
      'member-role',
      ACTOR_ID
    );

    expect(result).toMatchObject({ roleId: 'member-role' });
    expect(mockPrisma.$executeRaw).toHaveBeenCalledOnce();
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' }
    );
    expect(
      mockPrisma.$executeRaw.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mockPrisma.companyMember.findFirst.mock.invocationCallOrder[0]
    );
  });

  it('retries a serialization conflict as a complete read-check-write transaction', async () => {
    const transaction = mockPrisma.$transaction;
    transaction
      .mockImplementationOnce(() => Promise.reject({ code: 'P2034' }))
      .mockImplementation((callback: (tx: typeof mockPrisma) => unknown) =>
        callback(mockPrisma)
      );

    await expect(
      new CompanyService().updateMemberRole(
        COMPANY_ID,
        TARGET_ID,
        'member-role',
        ACTOR_ID
      )
    ).resolves.toMatchObject({ roleId: 'member-role' });

    expect(transaction).toHaveBeenCalledTimes(2);
    expect(mockPrisma.$executeRaw).toHaveBeenCalledOnce();
    expect(mockPrisma.companyMember.update).toHaveBeenCalledOnce();
  });

  it('applies the same lock and last-owner invariant to membership removal', async () => {
    mockPrisma.companyMember.findFirst.mockResolvedValue(null);

    await expect(
      new CompanyService().removeMember(
        COMPANY_ID,
        TARGET_ID,
        ACTOR_ID
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(mockPrisma.$executeRaw).toHaveBeenCalledOnce();
    expect(mockPrisma.companyMember.delete).not.toHaveBeenCalled();
  });

  it('prevents privileged actors from removing their own membership', async () => {
    mockPrisma.companyMember.findUnique.mockReset();
    mockPrisma.companyMember.findUnique
      .mockResolvedValueOnce({ role: { name: 'Administrator' } })
      .mockResolvedValueOnce({ role: { name: 'Administrator' } });

    await expect(
      new CompanyService().removeMember(
        COMPANY_ID,
        ACTOR_ID,
        ACTOR_ID
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(mockPrisma.companyMember.delete).not.toHaveBeenCalled();
  });
});
