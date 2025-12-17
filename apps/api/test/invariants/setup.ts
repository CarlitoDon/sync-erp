import { prisma } from '@sync-erp/database';
import { beforeAll, afterAll } from 'vitest';

export { prisma };

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});
