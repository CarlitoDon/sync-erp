import { describe, expect, it } from 'vitest';
import { CreateUserSchema } from '@sync-erp/shared';
import { authRouter } from '../../src/trpc/routers/auth.router';
import { userRouter } from '../../src/trpc/routers/user.router';

function procedureNames(router: {
  _def: { procedures: Record<string, unknown> };
}) {
  return Object.keys(router._def.procedures);
}

describe('productization API surface', () => {
  it('does not expose session lookup by arbitrary session id', () => {
    expect(procedureNames(authRouter)).not.toContain('getSession');
  });

  it('does not expose admin-created user mutation', () => {
    expect(procedureNames(userRouter)).not.toContain('create');
  });

  it('does not accept password hashes in shared user input schema', () => {
    const parsed = CreateUserSchema.safeParse({
      email: 'member@example.com',
      name: 'Member Example',
      passwordHash: 'server-only',
    });

    expect(parsed.success).toBe(false);
  });
});
