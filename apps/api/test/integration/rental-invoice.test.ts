import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  InvoiceStatus,
  InvoiceType,
  UnitCondition,
  UnitStatus,
  RentalOrderStatus,
  ReturnStatus,
  JournalSourceType,
  DepositPolicyType,
  AccountType,
  BillingProvider,
  BillingSubscriptionStatus,
} from '@sync-erp/database';
import { RentalService } from '@modules/rental/rental.service';

const rentalService = new RentalService();

const COMPANY_ID = 'test-rental-invoice-001';
const ACTOR_ID = 'test-user-inv-001';

describe('Rental Invoice Integration', () => {
  let rentalItemId: string;
  let customerId: string;
  let rentalOrderId: string;
  let unitId: string;
  let productId: string;

  beforeAll(async () => {
    // Clean Setup
    await prisma.$transaction([
      prisma.payment.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.journalEntry.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.invoice.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.rentalReturn.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.itemConditionLog.deleteMany({
        where: { rentalItemUnit: { companyId: COMPANY_ID } },
      }),
      prisma.rentalOrder.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.rentalItem.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.product.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.partner.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.company.deleteMany({ where: { id: COMPANY_ID } }),
    ]);

    // Create Company
    await prisma.company.create({
      data: {
        id: COMPANY_ID,
        name: 'Rental Invoice Test Corp',
      },
    });
    await prisma.companySubscription.create({
      data: {
        companyId: COMPANY_ID,
        planKey: 'growth',
        status: BillingSubscriptionStatus.ACTIVE,
        provider: BillingProvider.MANUAL,
      },
    });

    // Create Default Policy
    await prisma.rentalPolicy.create({
      data: {
        companyId: COMPANY_ID,
        effectiveFrom: new Date(),
        gracePeriodHours: 24,
        cleaningFee: 50000,
        lateFeeDailyRate: 100000,
        defaultDepositPolicyType: DepositPolicyType.PER_UNIT,
        defaultDepositPerUnit: 0,
        pickupGracePeriodHours: 48,
        createdBy: ACTOR_ID,
      },
    });

    // Create Customer
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Invoice Customer',
        email: 'inv@test.com',
        type: 'CUSTOMER',
      },
    });
    customerId = partner.id;

    // Seed Chart of Accounts (must include accounts needed for stock conversion)
    await prisma.account.createMany({
      data: [
        {
          companyId: COMPANY_ID,
          code: '1100',
          name: 'Cash/Bank',
          type: AccountType.ASSET,
          isGroup: false,
        },
        {
          companyId: COMPANY_ID,
          code: '1400',
          name: 'Inventory Asset',
          type: AccountType.ASSET,
          isGroup: false,
        },
        {
          companyId: COMPANY_ID,
          code: '2400',
          name: 'Customer Deposits',
          type: AccountType.LIABILITY,
          isGroup: false,
        },
        {
          companyId: COMPANY_ID,
          code: '2200',
          name: 'Uang Muka Sewa',
          type: AccountType.LIABILITY,
          isGroup: false,
        },
        {
          companyId: COMPANY_ID,
          code: '4200',
          name: 'Rental Revenue',
          type: AccountType.REVENUE,
          isGroup: false,
        },
        {
          companyId: COMPANY_ID,
          code: '5200',
          name: 'Inventory Adjustment',
          type: AccountType.EXPENSE,
          isGroup: false,
        },
      ],
    });

    // Create Product for Rental
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `CAM-${Date.now()}`,
        name: 'Expensive Camera',
        price: 5000000,
        averageCost: 0,
        stockQty: 0,
      },
    });
    productId = product.id;

    // Create Rental Item
    const item = await rentalService.createItem(
      COMPANY_ID,
      {
        productId: productId,
        dailyRate: 100000,
        weeklyRate: 600000,
        monthlyRate: 2000000,
        depositPolicyType: DepositPolicyType.PER_UNIT,
        depositPerUnit: 100000, // Small deposit
      },
      ACTOR_ID
    );
    rentalItemId = item.id;

    // First add stock for conversion (since product starts with 0 stock)
    await prisma.product.update({
      where: { id: productId },
      data: { stockQty: 1, averageCost: 1000000 },
    });

    // Convert stock to rental unit (simplified: no prefix/startNumber)
    const count = await rentalService.convertStockToUnits(
      COMPANY_ID,
      item.id,
      1, // quantity
      ACTOR_ID
    );
    expect(count).toBe(1);

    // Fetch created unit
    const units = await prisma.rentalItemUnit.findMany({
      where: { rentalItemId: item.id, companyId: COMPANY_ID },
    });
    unitId = units[0].id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.$transaction([
      prisma.payment.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.journalEntry.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.invoice.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.rentalReturn.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.itemConditionLog.deleteMany({
        where: { rentalItemUnit: { companyId: COMPANY_ID } },
      }),
      prisma.rentalOrder.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.rentalItem.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.partner.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.company.deleteMany({ where: { id: COMPANY_ID } }),
    ]);
  });

  it('should create an invoice when return charges exceed deposit', async () => {
    // 1. Create Order
    const startDate = new Date();
    const endDate = new Date(
      startDate.getTime() + 24 * 60 * 60 * 1000
    ); // 1 day

    const order = await rentalService.createOrder(
      COMPANY_ID,
      {
        partnerId: customerId,
        rentalStartDate: startDate,
        rentalEndDate: endDate,
        items: [{ rentalItemId, quantity: 1 }],
      },
      ACTOR_ID
    );
    rentalOrderId = order.id;

    // 2. Confirm Order (Pay Small Deposit)
    await rentalService.confirmOrder(
      COMPANY_ID,
      {
        orderId: rentalOrderId,
        depositAmount: 100000, // Matches small deposit policy
        paymentMethod: 'CASH',
        unitAssignments: [{ unitId }],
      },
      ACTOR_ID
    );

    // 2.5 Release Order (Pick up)
    await rentalService.releaseOrder(
      COMPANY_ID,
      {
        orderId: rentalOrderId,
        unitAssignments: [
          {
            unitId,
            beforePhotos: ['https://example.com/photo.jpg'],
            condition: UnitCondition.NEW,
          },
        ],
      },
      ACTOR_ID
    );

    // 3. Process Return with Major Damage
    // Damage Charge: 150,000 (Major)
    // Deposit:       100,000
    // Overage:        50,000
    const returnDate = new Date(endDate.getTime() + 1000); // On time

    const returnProcess = await rentalService.processReturn(
      COMPANY_ID,
      {
        orderId: rentalOrderId,
        actualReturnDate: returnDate,
        units: [
          {
            unitId,
            condition: UnitCondition.NEEDS_REPAIR,
            damageSeverity: 'MAJOR',
            damageNotes: 'Lens broken',
            afterPhotos: [],
          },
        ],
      },
      ACTOR_ID
    );

    expect(Number(returnProcess.totalCharges)).toBeGreaterThanOrEqual(
      150000
    );
    expect(Number(returnProcess.depositDeduction)).toBe(100000);
    expect(Number(returnProcess.depositRefund)).toBe(0);
    expect(Number(returnProcess.additionalChargesDue)).toBe(50000);

    // 4. Finalize Return
    await rentalService.finalizeReturn(
      COMPANY_ID,
      returnProcess.id,
      ACTOR_ID
    );

    // 5. Create Invoice for Overage
    const invoice = await rentalService.createInvoiceFromReturn(
      COMPANY_ID,
      returnProcess.id
    );

    expect(invoice).toBeDefined();
    expect(invoice.type).toBe(InvoiceType.RENTAL);
    expect(invoice.status).toBe(InvoiceStatus.DRAFT);
    expect(Number(invoice.amount)).toBe(50000);
    expect(invoice.partnerId).toBe(customerId);

    // 6. Duplicate invoice creation must be rejected
    await expect(
      rentalService.createInvoiceFromReturn(COMPANY_ID, returnProcess.id)
    ).rejects.toThrow();
  });

  it('should process return with on-the-spot payment covering damage and late fees without journal unique constraint conflict', async () => {
    const spotUnit = await prisma.rentalItemUnit.create({
      data: {
        companyId: COMPANY_ID,
        rentalItemId,
        unitCode: `UNIT-SPOT-${Date.now()}`,
        status: UnitStatus.AVAILABLE,
        condition: UnitCondition.GOOD,
      },
    });

    const startDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const endDate = new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000);
    const lateReturnDate = new Date(endDate.getTime() + 2 * 24 * 60 * 60 * 1000);

    const order = await rentalService.createOrder(
      COMPANY_ID,
      {
        partnerId: customerId,
        rentalStartDate: startDate,
        rentalEndDate: endDate,
        items: [{ rentalItemId, quantity: 1 }],
      },
      ACTOR_ID
    );

    await rentalService.confirmOrder(
      COMPANY_ID,
      {
        orderId: order.id,
        paymentMethod: 'CASH',
        unitAssignments: [{ unitId: spotUnit.id }],
      },
      ACTOR_ID
    );

    await rentalService.releaseOrder(
      COMPANY_ID,
      {
        orderId: order.id,
        unitAssignments: [
          {
            unitId: spotUnit.id,
            beforePhotos: ['https://example.com/before.jpg'],
            condition: UnitCondition.GOOD,
          },
        ],
      },
      ACTOR_ID
    );

    // Total charges: 150,000 (damage) + 200,000 (late: 1 day overdue after 24h grace) = 350,000
    // Customer pays partial: 200,000 cash on the spot (covers 150,000 damage + 50,000 late)
    const returnProcess = await rentalService.processReturn(
      COMPANY_ID,
      {
        orderId: order.id,
        actualReturnDate: lateReturnDate,
        units: [
          {
            unitId: spotUnit.id,
            condition: UnitCondition.NEEDS_REPAIR,
            damageSeverity: 'MAJOR', // 150,000
            afterPhotos: [],
          },
        ],
        damagePayment: {
          amount: 200000,
          paymentMethod: 'CASH',
        },
      },
      ACTOR_ID
    );

    // Unsettled because 200,000 < 350,000 total charges
    expect(returnProcess.settlementStatus).toBe(ReturnStatus.DRAFT);

    // N1: Units remain RENTED and order remains ACTIVE while return is unsettled
    const unitWhileUnsettled = await prisma.rentalItemUnit.findUnique({
      where: { id: spotUnit.id },
    });
    expect(unitWhileUnsettled?.status).toBe(UnitStatus.RENTED);

    const orderWhileUnsettled = await prisma.rentalOrder.findUnique({
      where: { id: order.id },
    });
    expect(orderWhileUnsettled?.status).toBe(RentalOrderStatus.ACTIVE);

    // N3: Verify journals were created for both damage (150k) and late (50k) without unique constraint collision
    const journals = await prisma.journalEntry.findMany({
      where: {
        companyId: COMPANY_ID,
        sourceType: JournalSourceType.RENTAL_RETURN,
      },
    });
    expect(journals.length).toBe(2);

    // N2: Create Invoice for remaining balance (350,000 - 200,000 paid = 150,000)
    const invoice = await rentalService.createInvoiceFromReturn(
      COMPANY_ID,
      returnProcess.id
    );
    expect(invoice).toBeDefined();
    expect(Number(invoice.amount)).toBe(150000);

    // Duplicate invoice creation rejected
    await expect(
      rentalService.createInvoiceFromReturn(COMPANY_ID, returnProcess.id)
    ).rejects.toThrow();

    // H6: Finalize return settles return, routes unit to MAINTENANCE, completes order
    const finalized = await rentalService.finalizeReturn(
      COMPANY_ID,
      returnProcess.id,
      ACTOR_ID
    );
    expect(finalized.settlementStatus).toBe(ReturnStatus.SETTLED);

    const finalUnit = await prisma.rentalItemUnit.findUnique({
      where: { id: spotUnit.id },
    });
    expect(finalUnit?.status).toBe(UnitStatus.MAINTENANCE);

    const finalOrder = await prisma.rentalOrder.findUnique({
      where: { id: order.id },
    });
    expect(finalOrder?.status).toBe(RentalOrderStatus.COMPLETED);
  });
});
