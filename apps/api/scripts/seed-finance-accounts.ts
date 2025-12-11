import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ACCOUNTS = [
  { code: '1100', name: 'Cash', type: 'ASSET' },
  { code: '1200', name: 'Bank', type: 'ASSET' },
  { code: '1300', name: 'Accounts Receivable', type: 'ASSET' },
  { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
  { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
  { code: '4100', name: 'Sales Revenue', type: 'REVENUE' },
  { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE' },
  { code: '5200', name: 'Inventory Adjustment', type: 'EXPENSE' },
] as const;

async function main() {
  const companyId = 'demo-company-001'; // Assuming demo company from main seed
  console.log(`Seeding accounts for company: ${companyId}...`);

  for (const acc of ACCOUNTS) {
    await prisma.account.upsert({
      where: {
        companyId_code: {
          companyId,
          code: acc.code,
        },
      },
      update: {},
      create: {
        companyId,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        isActive: true,
      },
    });
    console.log(` - Upserted ${acc.code} (${acc.name})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
