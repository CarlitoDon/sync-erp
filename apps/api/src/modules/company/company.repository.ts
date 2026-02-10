import {
  Company,
  CompanyMember,
  BusinessShape,
} from '@sync-erp/database';
import { prisma } from '@sync-erp/database';

export class CompanyRepository {
  async create(data: {
    name: string;
    userId?: string;
  }): Promise<Company> {
    return prisma.company.create({
      data: {
        name: data.name,
        ...(data.userId && {
          members: {
            create: {
              userId: data.userId,
            },
          },
        }),
      },
      include: {
        members: !!data.userId,
      },
    });
  }

  async findByInviteCode(
    inviteCode: string
  ): Promise<Company | null> {
    return prisma.company.findUnique({
      where: { inviteCode },
    });
  }

  async findById(id: string): Promise<Company | null> {
    return prisma.company.findUnique({
      where: { id },
    });
  }

  async findMembership(
    userId: string,
    companyId: string
  ): Promise<CompanyMember | null> {
    return prisma.companyMember.findUnique({
      where: {
        userId_companyId: {
          userId,
          companyId,
        },
      },
    });
  }

  async addMember(
    userId: string,
    companyId: string
  ): Promise<CompanyMember> {
    return prisma.companyMember.create({
      data: {
        userId,
        companyId,
      },
    });
  }

  async findMemberships(
    userId: string
  ): Promise<(CompanyMember & { company: Company })[]> {
    return prisma.companyMember.findMany({
      where: { userId },
      include: {
        company: true,
      },
    });
  }

  /**
   * Update company businessShape (immutable once set from PENDING).
   */
  async updateShape(
    companyId: string,
    shape: BusinessShape
  ): Promise<Company> {
    return prisma.company.update({
      where: { id: companyId },
      data: { businessShape: shape },
    });
  }

  async updateMemberRole(
    companyId: string,
    userId: string,
    roleId: string
  ): Promise<CompanyMember> {
    return prisma.companyMember.update({
      where: {
        userId_companyId: {
          userId,
          companyId,
        },
      },
      data: { roleId },
    });
  }
}
