import { prisma, UnitStatus } from '@sync-erp/database';

async function main(): Promise<void> {
  console.log('--- Cleaning All Rental Orders from Local Dev DB ---');

  // 1. Count before deletion
  const orderCount = await prisma.rentalOrder.count();
  console.log(`Found ${orderCount} rental orders to delete.`);

  // 2. Delete related records in proper foreign key order
  // RentalReturn has FK to rentalOrderId with RESTRICT
  const deletedReturns = await prisma.rentalReturn.deleteMany({});
  console.log(`Deleted ${deletedReturns.count} rental returns.`);

  // ItemConditionLog might reference rentalOrderId with SetNull or Restrict
  const updatedLogs = await prisma.itemConditionLog.updateMany({
    where: { rentalOrderId: { not: null } },
    data: { rentalOrderId: null },
  });
  console.log(`Disassociated ${updatedLogs.count} item condition logs.`);

  // RentalOrderExtensionItem & RentalOrderExtension
  const deletedExtItems = await prisma.rentalOrderExtensionItem.deleteMany({});
  console.log(`Deleted ${deletedExtItems.count} rental order extension items.`);
  const deletedExts = await prisma.rentalOrderExtension.deleteMany({});
  console.log(`Deleted ${deletedExts.count} rental order extensions.`);

  // RentalOrderUnitAssignment
  const deletedAssignments = await prisma.rentalOrderUnitAssignment.deleteMany({});
  console.log(`Deleted ${deletedAssignments.count} unit assignments.`);

  // RentalDeposit
  const deletedDeposits = await prisma.rentalDeposit.deleteMany({});
  console.log(`Deleted ${deletedDeposits.count} rental deposits.`);

  // RentalOrderItem
  const deletedItems = await prisma.rentalOrderItem.deleteMany({});
  console.log(`Deleted ${deletedItems.count} rental order items.`);

  // RentalOrder
  const deletedOrders = await prisma.rentalOrder.deleteMany({});
  console.log(`Successfully deleted ${deletedOrders.count} rental orders.`);

  // 3. Reset all rental item units to AVAILABLE
  const resetUnits = await prisma.rentalItemUnit.updateMany({
    where: { status: { not: UnitStatus.AVAILABLE } },
    data: { status: UnitStatus.AVAILABLE },
  });
  console.log(`Reset ${resetUnits.count} units back to status AVAILABLE.`);

  const remainingOrders = await prisma.rentalOrder.count();
  console.log(`Verification: Remaining rental orders = ${remainingOrders}.`);
}

main()
  .catch((e) => {
    console.error('Failed to clean rental orders:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
