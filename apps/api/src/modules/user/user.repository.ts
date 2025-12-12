import {
  prisma,
  type User,
  type CompanyMember,
  type Role,
  Prisma,
} from '@sync-erp/database';

export class UserRepository {
  async create(data: Prisma.UserCreateInput): Promise<User> {
    return prisma.user.create({ data });
  }

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async findMembersByCompany(
    companyId: string
  ): Promise<(CompanyMember & { user: User; role: Role | null })[]> {
    return prisma.companyMember.findMany({
      where: { companyId },
      include: {
        user: true,
        role: true,
      },
    });
  }

  async addMember(data: Prisma.CompanyMemberUncheckedCreateInput) {
    return prisma.companyMember.create({
      data,
      include: {
        user: true,
        company: true,
        role: true,
      },
    });
  }

  async removeMember(userId: string, companyId: string) {
    return prisma.companyMember.delete({
      where: {
        userId_companyId: {
          userId,
          companyId,
        },
      },
    });
  }
}
