import { PrismaClient } from '@sync-erp/database';
import { AccountService } from '../src/services/AccountService';

const prisma = new PrismaClient();
const accountService = new AccountService();

async function main() {
  console.log('Starting Account Repair...');

  // 1. Get all companies
  const companies = await prisma.company.findMany();
  console.log(`Found ${companies.length} companies.`);

  for (const company of companies) {
    console.log(
      `Checking accounts for company: ${company.name} (${company.id})...`
    );

    // 2. Run seedDefaultAccounts for each
    // The service method is idempotent (checks existence before creating)
    const accounts = await accountService.seedDefaultAccounts(
      company.id
    );

    console.log(
      `  - Ensured ${accounts.length} default accounts exist.`
    );

    // 3. Specifically verify 2105
    const acc2105 = await accountService.getByCode(
      company.id,
      '2105'
    );
    if (acc2105) {
      console.log('  - ✅ Account 2105 (Unbilled Liability) exists.');
    } else {
      console.error('  - ❌ FAILED to create Account 2105.');
    }
  }

  console.log('Repair Complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
