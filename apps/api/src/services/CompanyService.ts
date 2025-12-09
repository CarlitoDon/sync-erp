import { prisma, type Company, type CompanyMember } from '@sync-erp/database';
import type { CreateCompanyInput } from '@sync-erp/shared';

export class CompanyService {
  /**
   * Create a new company and optionally assign the creating user as a member
   */
  async create(data: CreateCompanyInput, userId?: string) {
    const company = await prisma.company.create({
      data: {
        name: data.name,
        ...(userId && {
          members: {
            create: {
              userId,
            },
          },
        }),
      },
      include: {
        members: userId ? true : false,
      },
    });

    return company;
  }

  /**
   * Get company by ID
   */
  async getById(id: string): Promise<Company | null> {
    return prisma.company.findUnique({
      where: { id },
    });
  }

  /**
   * List all companies for a specific user
   */
  async listForUser(userId: string): Promise<Company[]> {
    const memberships = await prisma.companyMember.findMany({
      where: { userId },
      include: {
        company: true,
      },
    });

    return memberships.map((m: CompanyMember & { company: Company }) => m.company);
  }

  /**
   * Check if a user is a member of a company
   */
  async isMember(userId: string, companyId: string): Promise<boolean> {
    const membership = await prisma.companyMember.findUnique({
      where: {
        userId_companyId: {
          userId,
          companyId,
        },
      },
    });

    return !!membership;
  }
}
