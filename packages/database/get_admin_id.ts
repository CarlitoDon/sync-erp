/* eslint-disable no-console */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { PrismaClient } from './src/generated/client/client.js';

import { PrismaPg } from '@prisma/adapter-pg';
import * as pg from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'admin@sync-erp.local' },
  });
  if (user) {
    console.log(`ADMIN_USER_ID=${user.id}`);
  } else {
    console.log('Admin user not found');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
