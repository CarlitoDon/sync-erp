import { Prisma } from '@sync-erp/database';
import { type User } from '@sync-erp/database';
import { UserRepository } from './user.repository';
import { CompanyService } from '../company/company.service';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

export type PublicUser = Omit<User, 'passwordHash'>;

export function toPublicUser(user: User): PublicUser {
  const publicUser: Partial<User> = { ...user };
  delete publicUser.passwordHash;
  return publicUser as PublicUser;
}

export interface CreateUserInput {
  email: string;
  name: string;
  passwordHash?: string;
  emailVerifiedAt?: Date | null;
}

export class UserService {
  constructor(
    private readonly repository: UserRepository = new UserRepository(),
    private readonly companyService: CompanyService = new CompanyService()
  ) {}

  async create(
    data: CreateUserInput,
    companyId?: string
  ): Promise<User> {
    const createData: Prisma.UserCreateInput = {
      email: data.email,
      name: data.name,
      passwordHash: data.passwordHash || '',
      emailVerifiedAt: data.emailVerifiedAt,
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

  async markEmailVerified(userId: string): Promise<User> {
    return this.repository.markEmailVerified(userId);
  }

  async delete(userId: string): Promise<User> {
    return this.repository.delete(userId);
  }

  async listByCompany(companyId: string) {
    const members =
      await this.repository.findMembersByCompany(companyId);
    return members.map((m) => ({
      ...toPublicUser(m.user),
      role: m.role,
    }));
  }

  async assignToCompany(
    userId: string,
    companyId: string,
    roleId?: string
  ) {
    if (roleId) {
      throw new DomainError(
        'Direct role assignment is not allowed; use membership role management',
        403,
        DomainErrorCodes.FORBIDDEN
      );
    }

    return this.repository.addMember({
      userId,
      companyId,
    });
  }

  async removeFromCompany(
    userId: string,
    companyId: string,
    actorId?: string
  ) {
    if (!actorId) {
      throw new DomainError(
        'Actor identity is required for membership removal',
        403,
        DomainErrorCodes.FORBIDDEN
      );
    }

    return this.companyService.removeMember(
      companyId,
      userId,
      actorId
    );
  }
}
