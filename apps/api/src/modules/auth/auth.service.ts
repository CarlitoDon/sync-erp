import crypto from 'crypto';
import {
  User,
  Session,
  AuthAuditAction,
  OAuthProvider,
} from '@sync-erp/database';
import { RegisterPayload, LoginPayload } from '@sync-erp/shared';
import { AuthRepository } from './auth.repository';
import {
  PublicUser,
  toPublicUser,
  UserService,
} from '../user/user.service';
import { EmailService } from '../common/services/email.service';
import {
  AuthAuditService,
  type AuthAuditContext,
} from './auth-audit.service';
import {
  hashPassword,
  comparePassword,
  generateEmailVerificationToken,
  hashEmailVerificationToken,
} from './auth.utils';
import { type GoogleOAuthProfile } from './google-oauth.service';

export interface AuthResult {
  success: boolean;
  user?: PublicUser;
  session?: Session;
  verificationRequired?: boolean;
  verificationSentTo?: string;
  verificationUrl?: string;
  error?: {
    code: string;
    message: string;
  };
}

const INVALID_CREDENTIALS_MESSAGE =
  'Invalid email or password';
const EMAIL_NOT_VERIFIED_MESSAGE =
  'Please verify your email before signing in.';
const EMAIL_VERIFICATION_TOKEN_HOURS = 24;
const EMAIL_DELIVERY_FAILED_MESSAGE =
  'We could not send the verification email. Please try again.';

type VerificationTrigger = 'register' | 'resend';

export class AuthService {
  constructor(
    private readonly repository: AuthRepository = new AuthRepository(),
    private readonly userService: UserService = new UserService(),
    private readonly emailService: EmailService = new EmailService(),
    private readonly authAuditService: AuthAuditService = new AuthAuditService()
  ) {}

  private isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  private getWebAppUrl(): string {
    return (
      process.env.SYNC_ERP_WEB_URL ||
      process.env.VITE_SYNC_ERP_WEB_URL ||
      process.env.APP_URL ||
      'http://localhost:5173'
    );
  }

  private async issueEmailVerification(
    user: User,
    trigger: VerificationTrigger,
    context?: AuthAuditContext
  ) {
    const rawToken = generateEmailVerificationToken();
    const tokenHash = hashEmailVerificationToken(rawToken);
    const expiresAt = new Date(
      Date.now() + EMAIL_VERIFICATION_TOKEN_HOURS * 60 * 60 * 1000
    );

    const verificationToken =
      await this.repository.createEmailVerificationToken(
      user.id,
      tokenHash,
      expiresAt
    );

    const verificationUrl = `${this.getWebAppUrl()}/verify-email?token=${rawToken}`;

    const delivery = await this.emailService.sendVerificationEmail({
      to: user.email,
      name: user.name,
      verificationUrl,
    });

    if (!delivery.delivered) {
      await this.repository.deleteEmailVerificationToken(
        verificationToken.id
      );
      await this.authAuditService.record({
        userId: user.id,
        email: user.email,
        action: AuthAuditAction.VERIFICATION_EMAIL_FAILED,
        metadata: {
          provider: delivery.provider,
          reason: delivery.error || 'unknown error',
          trigger,
        },
        context,
      });

      throw new Error(
        delivery.error || EMAIL_DELIVERY_FAILED_MESSAGE
      );
    }

    await this.repository.deleteOtherEmailVerificationTokens(
      user.id,
      verificationToken.id
    );
    await this.authAuditService.record({
      userId: user.id,
      email: user.email,
      action: AuthAuditAction.VERIFICATION_EMAIL_SENT,
      metadata: {
        provider: delivery.provider,
        trigger,
      },
      context,
    });

    return {
      verificationUrl: this.isProduction()
        ? undefined
        : verificationUrl,
      verificationSentTo: user.email,
    };
  }

  private async createOAuthPlaceholderPasswordHash() {
    return hashPassword(crypto.randomBytes(32).toString('hex'));
  }

  async register(
    payload: RegisterPayload,
    context?: AuthAuditContext
  ): Promise<AuthResult> {
    const email = payload.email.trim().toLowerCase();
    const password = payload.password;
    const name = payload.name.trim().replace(/\s+/g, ' ');

    // Check if user exists
    const existingUser = await this.userService.getByEmail(email);
    if (existingUser) {
      return {
        success: false,
        error: { code: 'CONFLICT', message: 'Email already exists' },
      };
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await this.userService.create({
      email,
      name,
      passwordHash: hashedPassword,
    });

    await this.authAuditService.record({
      userId: user.id,
      email: user.email,
      action: AuthAuditAction.REGISTERED,
      context,
    });

    try {
      const verification = await this.issueEmailVerification(
        user,
        'register',
        context
      );

      return {
        success: true,
        user: toPublicUser(user),
        verificationRequired: true,
        verificationSentTo: verification.verificationSentTo,
        verificationUrl: verification.verificationUrl,
      };
    } catch {
      await this.userService.delete(user.id);
      return {
        success: false,
        error: {
          code: 'EMAIL_DELIVERY_FAILED',
          message: EMAIL_DELIVERY_FAILED_MESSAGE,
        },
      };
    }
  }

  async login(
    payload: LoginPayload,
    context?: AuthAuditContext
  ): Promise<AuthResult> {
    const email = payload.email.trim().toLowerCase();
    const { password } = payload;

    const user = await this.userService.getByEmail(email);
    if (!user) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: INVALID_CREDENTIALS_MESSAGE,
        },
      };
    }

    const isValid = await comparePassword(
      password,
      user.passwordHash
    );
    if (!isValid) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: INVALID_CREDENTIALS_MESSAGE,
        },
      };
    }

    if (!user.emailVerifiedAt) {
      await this.authAuditService.record({
        userId: user.id,
        email: user.email,
        action: AuthAuditAction.LOGIN_BLOCKED_UNVERIFIED,
        context,
      });
      return {
        success: false,
        error: {
          code: 'PRECONDITION_FAILED',
          message: EMAIL_NOT_VERIFIED_MESSAGE,
        },
      };
    }

    const session = await this.repository.createSession(user.id);

    return {
      success: true,
      user: toPublicUser(user),
      session,
    };
  }

  async logout(sessionId: string) {
    return this.repository.deleteSession(sessionId);
  }

  async resendVerification(
    emailInput: string,
    context?: AuthAuditContext
  ): Promise<AuthResult> {
    const email = emailInput.trim().toLowerCase();
    const user = await this.userService.getByEmail(email);

    if (user && !user.emailVerifiedAt) {
      await this.authAuditService.record({
        userId: user.id,
        email: user.email,
        action: AuthAuditAction.VERIFICATION_RESEND_REQUESTED,
        context,
      });
      try {
        const verification = await this.issueEmailVerification(
          user,
          'resend',
          context
        );
        return {
          success: true,
          verificationRequired: true,
          verificationSentTo: verification.verificationSentTo,
          verificationUrl: verification.verificationUrl,
        };
      } catch {
        return {
          success: false,
          error: {
            code: 'EMAIL_DELIVERY_FAILED',
            message: EMAIL_DELIVERY_FAILED_MESSAGE,
          },
        };
      }
    }

    return {
      success: true,
      verificationRequired: true,
      verificationSentTo: email,
    };
  }

  async verifyEmail(
    rawToken: string,
    context?: AuthAuditContext
  ): Promise<AuthResult> {
    const tokenHash = hashEmailVerificationToken(rawToken);
    const verificationToken =
      await this.repository.getActiveEmailVerificationToken(tokenHash);

    if (!verificationToken) {
      return {
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message:
            'Verification link is invalid or has expired. Please request a new one.',
        },
      };
    }

    const user = verificationToken.user.emailVerifiedAt
      ? verificationToken.user
      : await this.userService.markEmailVerified(
          verificationToken.userId
        );

    await this.repository.markEmailVerificationTokenConsumed(
      verificationToken.id
    );
    await this.repository.deleteOtherEmailVerificationTokens(
      user.id,
      verificationToken.id
    );
    await this.authAuditService.record({
      userId: user.id,
      email: user.email,
      action: AuthAuditAction.EMAIL_VERIFIED,
      context,
    });

    const session = await this.repository.createSession(user.id);

    return {
      success: true,
      user: toPublicUser(user),
      session,
    };
  }

  async authenticateWithGoogle(
    profile: GoogleOAuthProfile,
    context?: AuthAuditContext
  ): Promise<AuthResult> {
    const email = profile.email.trim().toLowerCase();
    const name =
      profile.name.trim().replace(/\s+/g, ' ') || email;

    if (!profile.emailVerified) {
      await this.authAuditService.record({
        email,
        action: AuthAuditAction.GOOGLE_OAUTH_FAILED,
        metadata: {
          provider: 'GOOGLE',
          reason: 'google_email_not_verified',
        },
        context,
      });
      return {
        success: false,
        error: {
          code: 'PRECONDITION_FAILED',
          message: 'Your Google account email is not verified.',
        },
      };
    }

    try {
      const linkedAccount = await this.repository.findOAuthAccount(
        OAuthProvider.GOOGLE,
        profile.subject
      );

      let user = linkedAccount?.user;
      let linkedExistingAccount = false;
      let createdUser = false;

      if (!user) {
        const existingUser = await this.userService.getByEmail(email);

        if (existingUser) {
          const existingGoogleLink =
            await this.repository.findOAuthAccountByUser(
              OAuthProvider.GOOGLE,
              existingUser.id
            );

          if (
            existingGoogleLink &&
            existingGoogleLink.providerAccountId !== profile.subject
          ) {
            await this.authAuditService.record({
              userId: existingUser.id,
              email,
              action: AuthAuditAction.GOOGLE_OAUTH_FAILED,
              metadata: {
                provider: 'GOOGLE',
                reason: 'google_account_link_conflict',
              },
              context,
            });
            return {
              success: false,
              error: {
                code: 'CONFLICT',
                message:
                  'This email is already linked to a different Google account.',
              },
            };
          }

          user = existingUser.emailVerifiedAt
            ? existingUser
            : await this.userService.markEmailVerified(existingUser.id);

          if (!existingGoogleLink) {
            await this.repository.createOAuthAccount(
              user.id,
              OAuthProvider.GOOGLE,
              profile.subject,
              email
            );
            linkedExistingAccount = true;
          }
        } else {
          user = await this.userService.create({
            email,
            name,
            passwordHash:
              await this.createOAuthPlaceholderPasswordHash(),
            emailVerifiedAt: new Date(),
          });
          await this.repository.createOAuthAccount(
            user.id,
            OAuthProvider.GOOGLE,
            profile.subject,
            email
          );
          createdUser = true;
        }
      } else if (!user.emailVerifiedAt) {
        user = await this.userService.markEmailVerified(user.id);
      }

      if (linkedExistingAccount || createdUser) {
        await this.authAuditService.record({
          userId: user.id,
          email: user.email,
          action: AuthAuditAction.GOOGLE_OAUTH_LINKED,
          metadata: {
            provider: 'GOOGLE',
            linkedExistingAccount,
            createdUser,
          },
          context,
        });
      }

      const session = await this.repository.createSession(user.id);

      await this.authAuditService.record({
        userId: user.id,
        email: user.email,
        action: AuthAuditAction.GOOGLE_OAUTH_SUCCEEDED,
        metadata: {
          provider: 'GOOGLE',
          linkedExistingAccount,
          createdUser,
        },
        context,
      });

      return {
        success: true,
        user: toPublicUser(user),
        session,
      };
    } catch (error) {
      await this.authAuditService.record({
        email,
        action: AuthAuditAction.GOOGLE_OAUTH_FAILED,
        metadata: {
          provider: 'GOOGLE',
          reason:
            error instanceof Error
              ? error.message
              : 'unknown error',
        },
        context,
      });
      return {
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message:
            'We could not complete Google sign-in. Please try again.',
        },
      };
    }
  }

  async getSession(sessionId: string) {
    const session = await this.repository.getSession(sessionId);
    if (!session) return null;

    return {
      ...session,
      user: toPublicUser(session.user),
    };
  }

  async getProfile(userId: string): Promise<PublicUser | null> {
    const user = await this.userService.getById(userId);
    return user ? toPublicUser(user) : null;
  }
}
