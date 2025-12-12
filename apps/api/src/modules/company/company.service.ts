import { Company } from '@sync-erp/database';
import { CompanyRepository } from './company.repository';
import { CreateCompanyDto, JoinCompanyDto } from '@sync-erp/shared';

export class CompanyService {
  private repository = new CompanyRepository();

  async create(data: CreateCompanyDto, userId?: string): Promise<Company> {
    return this.repository.create({ name: data.name, userId });
  }

  async join(data: JoinCompanyDto, userId: string): Promise<Company> {
    const company = await this.repository.findByInviteCode(data.inviteCode);

    if (!company) {
      throw new Error('Invalid invite code');
    }

    const membership = await this.repository.findMembership(userId, company.id);
    if (membership) {
      throw new Error('User is already a member of this company');
    }

    await this.repository.addMember(userId, company.id);

    return company;
  }

  async getById(id: string): Promise<Company | null> {
    return this.repository.findById(id);
  }

  async listForUser(userId: string): Promise<Company[]> {
    const memberships = await this.repository.findMemberships(userId);
    return memberships.map((m) => m.company);
  }

  async isMember(userId: string, companyId: string): Promise<boolean> {
    const membership = await this.repository.findMembership(userId, companyId);
    return !!membership;
  }
}
