import { Prisma } from '@sync-erp/database';
import {
  prisma,
  type User,
  type CompanyMember,
  type Role,
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

  async markEmailVerified(userId: string): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        emailVerifiedAt: new Date(),
      },
    });
  }

  async delete(userId: string): Promise<User> {
    return prisma.user.delete({
      where: { id: userId },
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

  async addMember(data: { userId: string; companyId: string }) {
    return prisma.companyMember.create({
      data,
      include: {
        user: true,
        company: true,
        role: true,
      },
    });
  }

}
