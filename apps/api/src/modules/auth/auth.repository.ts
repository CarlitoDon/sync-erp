import {
  prisma,
  type Session,
  type User,
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
}
