import { prisma } from './packages/database/src/client.js';

async function main() {
  console.log("=== Accounts ===");
  const accounts = await prisma.account.findMany({
    where: { companyId: 'f023d223-f787-4007-9660-1bfa155c6ec4' },
    orderBy: { code: 'asc' }
  });
  for (const acc of accounts) {
    console.log(`${acc.code} [${acc.type}]: ${acc.name} (id: ${acc.id})`);
  }

  console.log("\n=== Bank Accounts ===");
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { companyId: 'f023d223-f787-4007-9660-1bfa155c6ec4' }
  });
  console.log(bankAccounts);

  console.log("\n=== Payment Methods ===");
  const paymentMethods = await prisma.companyPaymentMethod.findMany({
    where: { companyId: 'f023d223-f787-4007-9660-1bfa155c6ec4' },
    include: { account: true }
  });
  for (const pm of paymentMethods) {
    console.log(`Code: ${pm.code}, Name: ${pm.name}, Type: ${pm.type}, BankAccount: ${pm.bankAccountId}, Account: ${pm.account?.code}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
