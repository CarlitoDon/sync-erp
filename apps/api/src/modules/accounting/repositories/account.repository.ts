import { prisma, Account, AccountType, Prisma } from '@sync-erp/database';

export class AccountRepository {
  async create(data: Prisma.AccountCreateInput): Promise<Account> {
    return prisma.account.create({ data });
  }

  async findById(id: string, companyId: string): Promise<Account | null> {
    return prisma.account.findFirst({
      where: { id, companyId },
    });
  }

  async findByCode(code: string, companyId: string): Promise<Account | null> {
    return prisma.account.findFirst({
      where: { code, companyId },
    });
  }

  async findAll(companyId: string, type?: AccountType): Promise<Account[]> {
    return prisma.account.findMany({
      where: {
        companyId,
        ...(type && { type }),
      },
      orderBy: { code: 'asc' },
    });
  }

  async update(id: string, data: Prisma.AccountUpdateInput): Promise<Account> {
    return prisma.account.update({
      where: { id },
      data,
    });
  }
}
