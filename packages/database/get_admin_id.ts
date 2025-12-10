import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
