import { prisma } from '@sync-erp/database';

async function main() {
  console.log('🚀 Starting Clean Slate Database Reset for Dev Server...');

  // Identify main company vs test companies
  const santiLiving = await prisma.company.findFirst({
    where: { name: { contains: 'Santi Living', mode: 'insensitive' } },
  });

  if (!santiLiving) {
    throw new Error('Santi Living company not found!');
  }

  console.log(`🏢 Main Company Identified: ${santiLiving.name} (${santiLiving.id})`);

  // 1. Delete all operational, financial, and master data across all tables
  console.log('🧹 Step 1: Cleaning all financial, operational, and transactional tables...');

  // Accounting & Cash
  const delJournalLines = await prisma.journalLine.deleteMany({});
  console.log(`   - Deleted JournalLine: ${delJournalLines.count}`);

  const delCashItems = await prisma.cashTransactionItem.deleteMany({});
  console.log(`   - Deleted CashTransactionItem: ${delCashItems.count}`);

  const delCashTx = await prisma.cashTransaction.deleteMany({});
  console.log(`   - Deleted CashTransaction: ${delCashTx.count}`);

  const delJournalEntries = await prisma.journalEntry.deleteMany({});
  console.log(`   - Deleted JournalEntry: ${delJournalEntries.count}`);

  // Invoices & Payments
  const delBillInstallments = await prisma.billInstallmentSchedule.deleteMany({});
  console.log(`   - Deleted BillInstallmentSchedule: ${delBillInstallments.count}`);

  const delPayments = await prisma.payment.deleteMany({});
  console.log(`   - Deleted Payment: ${delPayments.count}`);

  const delInvoiceItems = await prisma.invoiceItem.deleteMany({});
  console.log(`   - Deleted InvoiceItem: ${delInvoiceItems.count}`);

  const delInvoices = await prisma.invoice.deleteMany({});
  console.log(`   - Deleted Invoice: ${delInvoices.count}`);

  // Rental Operations
  const delDepAlloc = await prisma.rentalDepositAllocation.deleteMany({});
  console.log(`   - Deleted RentalDepositAllocation: ${delDepAlloc.count}`);

  const delRentalDeposits = await prisma.rentalDeposit.deleteMany({});
  console.log(`   - Deleted RentalDeposit: ${delRentalDeposits.count}`);

  const delRentalReturns = await prisma.rentalReturn.deleteMany({});
  console.log(`   - Deleted RentalReturn: ${delRentalReturns.count}`);

  const delItemCondLogs = await prisma.itemConditionLog.deleteMany({});
  console.log(`   - Deleted ItemConditionLog: ${delItemCondLogs.count}`);

  const delCleaningLogs = await prisma.cleaningLog.deleteMany({});
  console.log(`   - Deleted CleaningLog: ${delCleaningLogs.count}`);

  const delUnitAssign = await prisma.rentalOrderUnitAssignment.deleteMany({});
  console.log(`   - Deleted RentalOrderUnitAssignment: ${delUnitAssign.count}`);

  const delExtItems = await prisma.rentalOrderExtensionItem.deleteMany({});
  console.log(`   - Deleted RentalOrderExtensionItem: ${delExtItems.count}`);

  const delExt = await prisma.rentalOrderExtension.deleteMany({});
  console.log(`   - Deleted RentalOrderExtension: ${delExt.count}`);

  const delRentalOrderItems = await prisma.rentalOrderItem.deleteMany({});
  console.log(`   - Deleted RentalOrderItem: ${delRentalOrderItems.count}`);

  const delRentalOrders = await prisma.rentalOrder.deleteMany({});
  console.log(`   - Deleted RentalOrder: ${delRentalOrders.count}`);

  const delCustRisks = await prisma.customerRentalRisk.deleteMany({});
  console.log(`   - Deleted CustomerRentalRisk: ${delCustRisks.count}`);

  const delDamagePolicies = await prisma.rentalDamagePolicy.deleteMany({});
  console.log(`   - Deleted RentalDamagePolicy: ${delDamagePolicies.count}`);

  // Logistics & Inventory Movements
  const delMovements = await prisma.inventoryMovement.deleteMany({});
  console.log(`   - Deleted InventoryMovement: ${delMovements.count}`);

  const delStockLayers = await prisma.stockLayer.deleteMany({});
  console.log(`   - Deleted StockLayer: ${delStockLayers.count}`);

  const delFulfillmentItems = await prisma.fulfillmentItem.deleteMany({});
  console.log(`   - Deleted FulfillmentItem: ${delFulfillmentItems.count}`);

  const delFulfillments = await prisma.fulfillment.deleteMany({});
  console.log(`   - Deleted Fulfillment: ${delFulfillments.count}`);

  const delOrderItems = await prisma.orderItem.deleteMany({});
  console.log(`   - Deleted OrderItem: ${delOrderItems.count}`);

  const delOrders = await prisma.order.deleteMany({});
  console.log(`   - Deleted Order: ${delOrders.count}`);

  // Master Data: Rental Units, Bundles, Items, Products, Warehouses, Partners
  console.log('🧹 Step 2: Cleaning all Master Data (Catalog, Units, Bundles, Partners)...');

  const delBundleComponents = await prisma.rentalBundleComponent.deleteMany({});
  console.log(`   - Deleted RentalBundleComponent: ${delBundleComponents.count}`);

  const delRentalBundles = await prisma.rentalBundle.deleteMany({});
  console.log(`   - Deleted RentalBundle: ${delRentalBundles.count}`);

  const delRentalItemUnits = await prisma.rentalItemUnit.deleteMany({});
  console.log(`   - Deleted RentalItemUnit: ${delRentalItemUnits.count}`);

  const delRentalItems = await prisma.rentalItem.deleteMany({});
  console.log(`   - Deleted RentalItem: ${delRentalItems.count}`);

  const delRentalItemCategories = await prisma.rentalItemCategory.deleteMany({});
  console.log(`   - Deleted RentalItemCategory: ${delRentalItemCategories.count}`);

  const delProducts = await prisma.product.deleteMany({});
  console.log(`   - Deleted Product: ${delProducts.count}`);

  const delProductCategories = await prisma.productCategory.deleteMany({});
  console.log(`   - Deleted ProductCategory: ${delProductCategories.count}`);

  const delWarehouses = await prisma.warehouse.deleteMany({});
  console.log(`   - Deleted Warehouse: ${delWarehouses.count}`);

  const delAddresses = await prisma.address.deleteMany({});
  console.log(`   - Deleted Address: ${delAddresses.count}`);

  const delPartners = await prisma.partner.deleteMany({});
  console.log(`   - Deleted Partner: ${delPartners.count}`);

  const delAttachments = await prisma.attachment.deleteMany({});
  console.log(`   - Deleted Attachment: ${delAttachments.count}`);

  const delAuditLogs = await prisma.auditLog.deleteMany({});
  console.log(`   - Deleted AuditLog: ${delAuditLogs.count}`);

  const delSagaLogs = await prisma.sagaLog.deleteMany({});
  console.log(`   - Deleted SagaLog: ${delSagaLogs.count}`);

  const delIdempotencyKeys = await prisma.idempotencyKey.deleteMany({});
  console.log(`   - Deleted IdempotencyKey: ${delIdempotencyKeys.count}`);

  const delWebhooks = await prisma.webhookOutbox.deleteMany({});
  console.log(`   - Deleted WebhookOutbox: ${delWebhooks.count}`);

  const delTenantWebhooks = await prisma.tenantWebhookOutbox.deleteMany({});
  console.log(`   - Deleted TenantWebhookOutbox: ${delTenantWebhooks.count}`);

  // Step 3: Remove test companies
  console.log('🧹 Step 3: Cleaning test companies...');
  const testCompanies = await prisma.company.findMany({
    where: { id: { not: santiLiving.id } },
    select: { id: true, name: true },
  });

  for (const tc of testCompanies) {
    // Delete company-specific dependencies first
    await prisma.companyPaymentMethod.deleteMany({ where: { companyId: tc.id } });
    await prisma.account.deleteMany({ where: { companyId: tc.id } });
    await prisma.rentalPolicy.deleteMany({ where: { companyId: tc.id } });
    await prisma.documentSequence.deleteMany({ where: { companyId: tc.id } });
    await prisma.companyMember.deleteMany({ where: { companyId: tc.id } });
    await prisma.company.delete({ where: { id: tc.id } });
    console.log(`   - Removed test company: ${tc.name} (${tc.id})`);
  }

  // Step 4: Reset Document Sequences for Santi Living
  console.log('🔄 Step 4: Resetting document sequence counters for Santi Living...');
  const delDocSeq = await prisma.documentSequence.deleteMany({
    where: { companyId: santiLiving.id },
  });
  console.log(`   - Reset/Deleted DocumentSequences: ${delDocSeq.count}`);


  // Step 5: Verification
  console.log('\n📊 Clean Slate Verification Report for Santi Living:');
  const companyId = santiLiving.id;
  const [
    accountsCount,
    paymentMethodsCount,
    rentalPoliciesCount,
    usersCount,
    membersCount,
    productsCount,
    rentalItemsCount,
    rentalUnitsCount,
    rentalOrdersCount,
    ordersCount,
    invoicesCount,
    paymentsCount,
    journalEntriesCount,
    partnersCount,
  ] = await Promise.all([
    prisma.account.count({ where: { companyId } }),
    prisma.companyPaymentMethod.count({ where: { companyId } }),
    prisma.rentalPolicy.count({ where: { companyId } }),
    prisma.user.count(),
    prisma.companyMember.count({ where: { companyId } }),
    prisma.product.count({ where: { companyId } }),
    prisma.rentalItem.count({ where: { companyId } }),
    prisma.rentalItemUnit.count({ where: { companyId } }),
    prisma.rentalOrder.count({ where: { companyId } }),
    prisma.order.count({ where: { companyId } }),
    prisma.invoice.count({ where: { companyId } }),
    prisma.payment.count({ where: { companyId } }),
    prisma.journalEntry.count({ where: { companyId } }),
    prisma.partner.count({ where: { companyId } }),
  ]);

  console.log(`✅ Base Master Data Kept for Santi Living:`);
  console.log(`   - Chart of Accounts (COA): ${accountsCount}`);
  console.log(`   - Payment Methods: ${paymentMethodsCount}`);
  console.log(`   - Rental Policy: ${rentalPoliciesCount}`);
  console.log(`   - Users: ${usersCount} (Company Members: ${membersCount})`);
  console.log(`\n✅ Operational, Financial & Master Data Cleared:`);
  console.log(`   - Products / Catalog: ${productsCount}`);
  console.log(`   - Rental Items: ${rentalItemsCount}`);
  console.log(`   - Rental Item Units: ${rentalUnitsCount}`);
  console.log(`   - Rental Orders: ${rentalOrdersCount}`);
  console.log(`   - Sales / Purchase Orders: ${ordersCount}`);
  console.log(`   - Invoices / Bills: ${invoicesCount}`);
  console.log(`   - Payments: ${paymentsCount}`);
  console.log(`   - Journal Entries: ${journalEntriesCount}`);
  console.log(`   - Partners (Customers & Suppliers): ${partnersCount}`);

  console.log('\n✨ Database is now in a pristine "Clean Slate" state! Ready for fresh testing.');
}

main()
  .catch((err) => {
    console.error('❌ Error during clean slate execution:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
