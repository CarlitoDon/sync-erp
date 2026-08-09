import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CompanyService } from '@src/modules/company/company.service';
import { UserRepository } from '@src/modules/user/user.repository';
import { UserService } from '@src/modules/user/user.service';
import { RBACService } from '@src/middlewares/rbac';

const COMPANY_ID = '00000000-0000-0000-0000-000000000401';
const USER_ID = '00000000-0000-0000-0000-000000000402';
const ACTOR_ID = '00000000-0000-0000-0000-000000000403';

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listTypeScriptFiles(fullPath);
    }
    return entry.isFile() && entry.name.endsWith('.ts') ? [fullPath] : [];
  });
}

describe('membership mutation boundary', () => {
  it('rejects direct role assignment through UserService', async () => {
    const repository = {
      addMember: vi.fn(),
    } as unknown as UserRepository;
    const service = new UserService(repository);

    await expect(
      service.assignToCompany(USER_ID, COMPANY_ID, 'owner-role')
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(repository.addMember).not.toHaveBeenCalled();
  });

  it('delegates membership removal to CompanyService and fails closed without actor identity', async () => {
    const repository = {} as UserRepository;
    const companyService = {
      removeMember: vi.fn().mockResolvedValue({ id: 'membership' }),
    } as unknown as CompanyService;
    const service = new UserService(repository, companyService);

    await expect(
      service.removeFromCompany(USER_ID, COMPANY_ID)
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      service.removeFromCompany(USER_ID, COMPANY_ID, ACTOR_ID)
    ).resolves.toMatchObject({ id: 'membership' });

    expect(companyService.removeMember).toHaveBeenCalledWith(
      COMPANY_ID,
      USER_ID,
      ACTOR_ID
    );
  });

  it('delegates RBAC role assignment to CompanyService and fails closed without actor identity', async () => {
    const companyService = {
      updateMemberRole: vi.fn().mockResolvedValue({ id: 'membership' }),
    } as unknown as CompanyService;
    const service = new RBACService(companyService);

    await expect(
      service.assignRoleToUser(USER_ID, COMPANY_ID, 'member-role')
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      service.assignRoleToUser(
        USER_ID,
        COMPANY_ID,
        'member-role',
        ACTOR_ID
      )
    ).resolves.toMatchObject({ id: 'membership' });

    expect(companyService.updateMemberRole).toHaveBeenCalledWith(
      COMPANY_ID,
      USER_ID,
      'member-role',
      ACTOR_ID
    );
  });

  it('keeps every direct companyMember update/removal in CompanyService', () => {
    const sourceRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../src'
    );
    const mutationPattern =
      /companyMember\.(?:update|updateMany|delete|deleteMany)\s*\(/;
    const mutationSites = listTypeScriptFiles(sourceRoot)
      .filter((file) => mutationPattern.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(sourceRoot, file));

    expect(mutationSites).toEqual([
      path.join('modules', 'company', 'company.service.ts'),
    ]);
  });
});
