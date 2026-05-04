import {
  prisma,
  type Session,
  type User,
  type EmailVerificationToken,
  type OAuthAccount,
  OAuthProvider,
  Prisma,
} from '@sync-erp/database';

const SESSION_DURATION_DAYS = 7;

export class AuthRepository {
  async createSession(userId: string): Promise<Session> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

    return prisma.session.create({
      data: {
        userId,
        expiresAt,
      },
    });
  }

  async getSession(
    sessionId: string
  ): Promise<(Session & { user: User }) | null> {
    return prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });
  }

  async deleteSession(sessionId: string): Promise<Session> {
    return prisma.session.delete({
      where: { id: sessionId },
    });
  }

  async deleteUserSessions(
    userId: string
  ): Promise<Prisma.BatchPayload> {
    return prisma.session.deleteMany({
      where: { userId },
    });
  }

  async createEmailVerificationToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date
  ): Promise<EmailVerificationToken> {
    return prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  async deleteEmailVerificationTokens(
    userId: string
  ): Promise<Prisma.BatchPayload> {
    return prisma.emailVerificationToken.deleteMany({
      where: { userId },
    });
  }

  async deleteEmailVerificationToken(
    tokenId: string
  ): Promise<EmailVerificationToken> {
    return prisma.emailVerificationToken.delete({
      where: { id: tokenId },
    });
  }

  async deleteOtherEmailVerificationTokens(
    userId: string,
    keepTokenId: string
  ): Promise<Prisma.BatchPayload> {
    return prisma.emailVerificationToken.deleteMany({
      where: {
        userId,
        id: {
          not: keepTokenId,
        },
      },
    });
  }

  async getActiveEmailVerificationToken(tokenHash: string) {
    return prisma.emailVerificationToken.findFirst({
      where: {
        tokenHash,
        consumedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });
  }

  async markEmailVerificationTokenConsumed(
    tokenId: string
  ): Promise<EmailVerificationToken> {
    return prisma.emailVerificationToken.update({
      where: { id: tokenId },
      data: {
        consumedAt: new Date(),
      },
    });
  }

  async findOAuthAccount(
    provider: OAuthProvider,
    providerAccountId: string
  ): Promise<(OAuthAccount & { user: User }) | null> {
    return prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
      include: {
        user: true,
      },
    });
  }

  async findOAuthAccountByUser(
    provider: OAuthProvider,
    userId: string
  ): Promise<OAuthAccount | null> {
    return prisma.oAuthAccount.findUnique({
      where: {
        provider_userId: {
          provider,
          userId,
        },
      },
    });
  }

  async createOAuthAccount(
    userId: string,
    provider: OAuthProvider,
    providerAccountId: string,
    email: string
  ): Promise<OAuthAccount> {
    return prisma.oAuthAccount.create({
      data: {
        userId,
        provider,
        providerAccountId,
        email,
      },
    });
  }
}
