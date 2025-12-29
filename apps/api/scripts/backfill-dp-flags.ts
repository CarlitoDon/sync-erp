import { prisma } from '@sync-erp/database';

async function main() {
  console.log('Starting DP Bill backfill...');

  // Find all bills with "Down Payment" in notes and set isDownPayment=true
  const updateResult = await prisma.invoice.updateMany({
    where: {
      notes: {
        contains: 'Down Payment',
      },
      type: 'BILL',
      isDownPayment: false, // Only update if not already set
    },
    data: {
      isDownPayment: true,
    },
  });

  console.log(
    `Backfill complete. Updated ${updateResult.count} bills.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
