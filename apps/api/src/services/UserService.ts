import { prisma, type User, type CompanyMember, type Role } from '@sync-erp/database';

interface CreateUserInput {
  email: string;
  name: string;
}

export class UserService {
  /**
   * Create a new user and optionally assign to a company
   */
  async create(data: CreateUserInput, companyId?: string): Promise<User> {
    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash: '', // Placeholder for users created without password (invites?)
        ...(companyId && {
          companies: {
            create: {
              companyId,
            },
          },
        }),
      },
    });

    return user;
  }

  /**
   * Get user by ID
   */
  async getById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Get user by email
   */
  async getByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * List users belonging to a company
   */
  async listByCompany(companyId: string) {
    const members = await prisma.companyMember.findMany({
      where: { companyId },
      include: {
        user: true,
        role: true,
      },
    });

    return members.map((m: CompanyMember & { user: User; role: Role | null }) => ({
      ...m.user,
      role: m.role,
    }));
  }

  /**
   * Assign a user to a company
   */
  async assignToCompany(userId: string, companyId: string, roleId?: string) {
    const member = await prisma.companyMember.create({
      data: {
        userId,
        companyId,
        roleId,
      },
      include: {
        user: true,
        company: true,
        role: true,
      },
    });

    return member;
  }

  /**
   * Remove user from company
   */
  async removeFromCompany(userId: string, companyId: string) {
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
