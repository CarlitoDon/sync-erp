/* eslint-disable no-console */
import { prisma } from '@sync-erp/database';

// JournalService expects these specific account codes
const ACCOUNTS = [
  // Assets
  { code: '1100', name: 'Cash', type: 'ASSET' },
  { code: '1200', name: 'Bank', type: 'ASSET' },
  { code: '1300', name: 'Accounts Receivable', type: 'ASSET' },
  { code: '1400', name: 'Inventory Asset', type: 'ASSET' },
  { code: '1500', name: 'VAT Receivable (Input)', type: 'ASSET' }, // JournalService: postBill

  // Liabilities
  { code: '2100', name: 'Accounts Payable', type: 'LIABILITY' },
  { code: '2105', name: 'GRNI Accrual', type: 'LIABILITY' }, // JournalService: postGoodsReceipt, postBill
  { code: '2300', name: 'VAT Payable (Output)', type: 'LIABILITY' }, // JournalService: postInvoice

  // Revenue
  { code: '4100', name: 'Sales Revenue', type: 'REVENUE' }, // JournalService: postInvoice

  // Expenses
  { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE' }, // JournalService: postShipment
  { code: '5200', name: 'Inventory Adjustment', type: 'EXPENSE' }, // JournalService: postAdjustment
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
