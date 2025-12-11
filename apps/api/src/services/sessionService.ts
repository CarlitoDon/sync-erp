import { prisma, Prisma } from '@sync-erp/database';
const SESSION_DURATION_DAYS = 7;

export async function createSession(userId: string) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  return prisma.session.create({
    data: {
      userId,
      expiresAt,
    },
  });
}

export async function getSession(sessionId: string) {
  return prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });
}

export async function deleteSession(sessionId: string) {
  return prisma.session.delete({
    where: { id: sessionId },
  });
}

export async function deleteUserSessions(userId: string): Promise<Prisma.BatchPayload> {
  return prisma.session.deleteMany({
    where: { userId },
  });
}
