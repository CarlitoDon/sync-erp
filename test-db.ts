import { prisma } from './packages/database/src/client.js';

async function main() {
  console.log("=== DB Connection Test ===");
  const usersCount = await prisma.user.count();
  console.log(`User count: ${usersCount}`);
  
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  console.log("Users:", users);

  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  console.log("Companies:", companies);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
