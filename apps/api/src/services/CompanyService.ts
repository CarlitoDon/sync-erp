import { prisma, type Company, type CompanyMember } from '@sync-erp/database';
import type { CreateCompanyDto, JoinCompanyDto } from '@sync-erp/shared';
// Mock error class for ComparatorError reference in previous step or use simple Error
class ComparatorError extends Error {}

export class CompanyService {
  /**
   * Create a new company and optionally assign the creating user as a member
   */
  async create(data: CreateCompanyDto, userId?: string) {
    const company = await prisma.company.create({
      data: {
        name: data.name,
        ...(userId && {
          members: {
            create: {
              userId,
              // Default role logic can go here later
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
   * Join a company using an invite code
   */
  async join(data: JoinCompanyDto, userId: string): Promise<Company> {
    const company = await prisma.company.findUnique({
      where: { inviteCode: data.inviteCode },
    });

    if (!company) {
      throw new Error('Invalid invite code');
    }

    // Check if already a member
    const isMember = await this.isMember(userId, company.id);
    if (isMember) {
      throw new ComparatorError('User is already a member of this company'); // Will be caught as regular error
    }

    await prisma.companyMember.create({
      data: {
        userId,
        companyId: company.id,
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
