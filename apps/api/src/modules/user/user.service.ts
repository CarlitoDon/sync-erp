import { Prisma } from '@sync-erp/database';
import { type User } from '@sync-erp/database';
import { UserRepository } from './user.repository';

export interface CreateUserInput {
  email: string;
  name: string;
  passwordHash?: string;
}

export class UserService {
  constructor(
    private readonly repository: UserRepository = new UserRepository()
  ) {}

  async create(
    data: CreateUserInput,
    companyId?: string
  ): Promise<User> {
    const createData: Prisma.UserCreateInput = {
      email: data.email,
      name: data.name,
      passwordHash: data.passwordHash || '',
    };

    if (companyId) {
      createData.companies = {
        create: {
          companyId,
        },
      };
    }

    return this.repository.create(createData);
  }

  async getById(id: string): Promise<User | null> {
    return this.repository.findById(id);
  }

  async getByEmail(email: string): Promise<User | null> {
    return this.repository.findByEmail(email);
  }

  async listByCompany(companyId: string) {
    const members =
      await this.repository.findMembersByCompany(companyId);
    return members.map((m) => ({
      ...m.user,
      role: m.role,
    }));
  }

  async assignToCompany(
    userId: string,
    companyId: string,
    roleId?: string
  ) {
    return this.repository.addMember({
      userId,
      companyId,
      roleId,
    });
  }

  async removeFromCompany(userId: string, companyId: string) {
    return this.repository.removeMember(userId, companyId);
  }
}
