import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../src/modules/auth/auth.service';
import { AuthAuditAction } from '@sync-erp/database';
import { hashPassword } from '../../src/modules/auth/auth.utils';

describe('AuthService Unit', () => {
  const repository = {
    createEmailVerificationToken: vi.fn(),
    deleteEmailVerificationToken: vi.fn(),
    deleteOtherEmailVerificationTokens: vi.fn(),
    getActiveEmailVerificationToken: vi.fn(),
    markEmailVerificationTokenConsumed: vi.fn(),
    findOAuthAccount: vi.fn(),
    findOAuthAccountByUser: vi.fn(),
    createOAuthAccount: vi.fn(),
    createSession: vi.fn(),
  };

  const userService = {
    getByEmail: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    markEmailVerified: vi.fn(),
  };

  const emailService = {
    sendVerificationEmail: vi.fn(),
  };

  const authAuditService = {
    record: vi.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      repository as never,
      userService as never,
      emailService as never,
      authAuditService as never
    );
  });

  it('rolls back registration when verification email delivery fails', async () => {
    userService.getByEmail.mockResolvedValue(null);
    userService.create.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'User Test',
      passwordHash: 'hashed-password',
      emailVerifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    repository.createEmailVerificationToken.mockResolvedValue({
      id: 'token-1',
    });
    emailService.sendVerificationEmail.mockResolvedValue({
      delivered: false,
      provider: 'resend',
      error: 'Resend API error',
    });

    const result = await service.register({
      email: 'user@example.com',
      name: 'User Test',
      password: 'password123',
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: 'EMAIL_DELIVERY_FAILED',
        message:
          'We could not send the verification email. Please try again.',
      },
    });
    expect(
      repository.deleteEmailVerificationToken
    ).toHaveBeenCalledWith('token-1');
    expect(userService.delete).toHaveBeenCalledWith('user-1');
    expect(authAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuthAuditAction.VERIFICATION_EMAIL_FAILED,
        email: 'user@example.com',
      })
    );
  });

  it('records audit and blocks login for unverified users', async () => {
    const passwordHash = await hashPassword('password123');

    userService.getByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'User Test',
      passwordHash,
      emailVerifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.login({
      email: 'user@example.com',
      password: 'password123',
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: 'PRECONDITION_FAILED',
        message: 'Please verify your email before signing in.',
      },
    });
    expect(authAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuthAuditAction.LOGIN_BLOCKED_UNVERIFIED,
        email: 'user@example.com',
      })
    );
  });

  it('creates a verified user and session from Google OAuth', async () => {
    repository.findOAuthAccount.mockResolvedValue(null);
    userService.getByEmail.mockResolvedValue(null);
    userService.create.mockResolvedValue({
      id: 'user-google-1',
      email: 'google@example.com',
      name: 'Google User',
      passwordHash: 'hashed-password',
      emailVerifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    repository.createOAuthAccount.mockResolvedValue({
      id: 'oauth-1',
      userId: 'user-google-1',
      provider: 'GOOGLE',
      providerAccountId: 'google-subject-1',
      email: 'google@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    repository.createSession.mockResolvedValue({
      id: 'session-1',
      userId: 'user-google-1',
      expiresAt: new Date(),
      createdAt: new Date(),
    });

    const result = await service.authenticateWithGoogle({
      subject: 'google-subject-1',
      email: 'google@example.com',
      emailVerified: true,
      name: 'Google User',
    });

    expect(result).toEqual({
      success: true,
      user: expect.objectContaining({
        id: 'user-google-1',
        email: 'google@example.com',
      }),
      session: expect.objectContaining({
        id: 'session-1',
      }),
    });
    expect(repository.createOAuthAccount).toHaveBeenCalledWith(
      'user-google-1',
      'GOOGLE',
      'google-subject-1',
      'google@example.com'
    );
    expect(authAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuthAuditAction.GOOGLE_OAUTH_LINKED,
        email: 'google@example.com',
      })
    );
    expect(authAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuthAuditAction.GOOGLE_OAUTH_SUCCEEDED,
        email: 'google@example.com',
      })
    );
  });

  it('links Google OAuth to an existing user with the same email', async () => {
    repository.findOAuthAccount.mockResolvedValue(null);
    userService.getByEmail.mockResolvedValue({
      id: 'existing-user-1',
      email: 'existing@example.com',
      name: 'Existing User',
      passwordHash: 'hashed-password',
      emailVerifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    repository.findOAuthAccountByUser.mockResolvedValue(null);
    userService.markEmailVerified.mockResolvedValue({
      id: 'existing-user-1',
      email: 'existing@example.com',
      name: 'Existing User',
      passwordHash: 'hashed-password',
      emailVerifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    repository.createSession.mockResolvedValue({
      id: 'session-2',
      userId: 'existing-user-1',
      expiresAt: new Date(),
      createdAt: new Date(),
    });

    const result = await service.authenticateWithGoogle({
      subject: 'google-subject-2',
      email: 'existing@example.com',
      emailVerified: true,
      name: 'Existing User',
    });

    expect(result.success).toBe(true);
    expect(userService.markEmailVerified).toHaveBeenCalledWith(
      'existing-user-1'
    );
    expect(repository.createOAuthAccount).toHaveBeenCalledWith(
      'existing-user-1',
      'GOOGLE',
      'google-subject-2',
      'existing@example.com'
    );
  });
});
