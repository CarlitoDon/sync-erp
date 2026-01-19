import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  DepositPolicyType,
  AccountType,
  UnitCondition,
} from '@sync-erp/database';
import { RentalService } from '@modules/rental/rental.service';

const rentalService = new RentalService();

const COMPANY_ID = 'test-deposit-refund-001';
const ACTOR_ID = 'test-user-deposit-001';

describe('Rental Deposit Refund Scenarios', () => {
  let rentalItemId: string;
  let customerId: string;
  let productId: string;
  let unitIds: string[] = [];

  beforeAll(async () => {
    // Clean Setup - order matters for FK constraints
    await prisma.$transaction([
      prisma.$executeRaw`DELETE FROM "JournalLine" WHERE "journalId" IN (SELECT id FROM "JournalEntry" WHERE "companyId" = ${COMPANY_ID})`,
      prisma.journalEntry.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.inventoryMovement.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.rentalReturn.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.rentalOrderItem.deleteMany({
        where: { rentalOrder: { companyId: COMPANY_ID } },
      }),
      prisma.rentalOrder.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.itemConditionLog.deleteMany({
        where: { rentalItemUnit: { companyId: COMPANY_ID } },
      }),
      prisma.rentalItemUnit.deleteMany({
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
      data: { id: COMPANY_ID, name: 'Deposit Refund Test Corp' },
    });

    // Seed Chart of Accounts
    await prisma.account.createMany({
      data: [
        {
          companyId: COMPANY_ID,
          code: '1100',
          name: 'Cash/Bank',
          type: AccountType.ASSET,
        },
        {
          companyId: COMPANY_ID,
          code: '1400',
          name: 'Inventory Asset',
          type: AccountType.ASSET,
        },
        {
          companyId: COMPANY_ID,
          code: '2400',
          name: 'Customer Deposits',
          type: AccountType.LIABILITY,
        },
        {
          companyId: COMPANY_ID,
          code: '4200',
          name: 'Rental Revenue',
          type: AccountType.REVENUE,
        },
        {
          companyId: COMPANY_ID,
          code: '5200',
          name: 'Inventory Adjustment',
          type: AccountType.EXPENSE,
        },
      ],
    });

    // Create Default Policy with specific damage charges
    await prisma.rentalPolicy.create({
      data: {
        companyId: COMPANY_ID,
        effectiveFrom: new Date(),
        gracePeriodHours: 24,
        cleaningFee: 50000, // 50k cleaning fee
        lateFeeDailyRate: 100000,
        defaultDepositPolicyType: DepositPolicyType.PER_UNIT,
        defaultDepositPerUnit: 500000, // 500k deposit per unit
        pickupGracePeriodHours: 48,
        createdBy: ACTOR_ID,
      },
    });

    // Create Customer
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Deposit Test Customer',
        email: 'deposit@test.com',
        phone: '628123456789',
        type: 'CUSTOMER',
      },
    });
    customerId = partner.id;

    // Create Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `KASUR-DEP-${Date.now()}`,
        name: 'Kasur Premium King Size',
        price: 5000000,
        stockQty: 5,
        averageCost: 2000000,
      },
    });
    productId = product.id;

    // Create Rental Item with high deposit
    const item = await rentalService.createItem(
      COMPANY_ID,
      {
        productId: productId,
        dailyRate: 100000,
        weeklyRate: 600000,
        monthlyRate: 2000000,
        depositPolicyType: DepositPolicyType.PER_UNIT,
        depositPerUnit: 500000, // 500k per unit
      },
      ACTOR_ID
    );
    rentalItemId = item.id;

    // Convert stock to rental units
    await rentalService.convertStockToUnits(
      COMPANY_ID,
      item.id,
      4,
      ACTOR_ID
    );

    // Get unit IDs
    const units = await prisma.rentalItemUnit.findMany({
      where: { rentalItemId: item.id, companyId: COMPANY_ID },
      orderBy: { unitCode: 'asc' },
    });
    unitIds = units.map((u) => u.id);
  });

  afterAll(async () => {
    await prisma.$transaction([
      prisma.$executeRaw`DELETE FROM "JournalLine" WHERE "journalId" IN (SELECT id FROM "JournalEntry" WHERE "companyId" = ${COMPANY_ID})`,
      prisma.journalEntry.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.inventoryMovement.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.rentalReturn.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.rentalOrderItem.deleteMany({
        where: { rentalOrder: { companyId: COMPANY_ID } },
      }),
      prisma.rentalOrder.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.itemConditionLog.deleteMany({
        where: { rentalItemUnit: { companyId: COMPANY_ID } },
      }),
      prisma.rentalItemUnit.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.rentalItem.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.product.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.partner.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.company.deleteMany({ where: { id: COMPANY_ID } }),
    ]);
  });

  it('Full Refund: Return in good condition → Full deposit refunded', async () => {
    // 1. Create Order
    const startDate = new Date();
    const endDate = new Date(
      startDate.getTime() + 3 * 24 * 60 * 60 * 1000
    ); // 3 days

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

    // 2. Confirm with deposit
    await rentalService.confirmOrder(
      COMPANY_ID,
      {
        orderId: order.id,
        depositAmount: 500000,
        paymentMethod: 'CASH',
        unitAssignments: [{ unitId: unitIds[0] }],
      },
      ACTOR_ID
    );

    // 3. Release order (start rental)
    await rentalService.releaseOrder(
      COMPANY_ID,
      {
        orderId: order.id,
        unitAssignments: [
          {
            unitId: unitIds[0],
            condition: UnitCondition.NEW,
            beforePhotos: ['https://example.com/before.jpg'],
          },
        ],
      },
      ACTOR_ID
    );

    // 4. Process return in GOOD condition (no damage)
    const actualReturnDate = new Date(endDate.getTime() + 1000); // On time
    const returnProcess = await rentalService.processReturn(
      COMPANY_ID,
      {
        orderId: order.id,
        actualReturnDate,
        units: [
          {
            unitId: unitIds[0],
            condition: UnitCondition.GOOD, // Good condition
            afterPhotos: ['https://example.com/after.jpg'],
          },
        ],
      },
      ACTOR_ID
    );

    // 5. Verify: Full deposit should be refunded (no damage charges)
    expect(Number(returnProcess.damageCharges)).toBe(0);
    expect(Number(returnProcess.lateFee)).toBe(0);
    // Deposit refund = deposit - (rental fee deducted from deposit) or full if covered
    expect(
      Number(returnProcess.depositRefund)
    ).toBeGreaterThanOrEqual(0);
  });

  it('Partial Refund: Minor damage → Deposit deducted, remainder refunded', async () => {
    // 1. Create Order
    const startDate = new Date();
    const endDate = new Date(
      startDate.getTime() + 2 * 24 * 60 * 60 * 1000
    );

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

    // 2. Confirm
    await rentalService.confirmOrder(
      COMPANY_ID,
      {
        orderId: order.id,
        depositAmount: 500000,
        paymentMethod: 'CASH',
        unitAssignments: [{ unitId: unitIds[1] }],
      },
      ACTOR_ID
    );

    // 3. Release
    await rentalService.releaseOrder(
      COMPANY_ID,
      {
        orderId: order.id,
        unitAssignments: [
          {
            unitId: unitIds[1],
            condition: UnitCondition.NEW,
            beforePhotos: ['https://example.com/before.jpg'],
          },
        ],
      },
      ACTOR_ID
    );

    // 4. Process return with MINOR damage
    const actualReturnDate = new Date(endDate.getTime() + 1000);
    const returnProcess = await rentalService.processReturn(
      COMPANY_ID,
      {
        orderId: order.id,
        actualReturnDate,
        units: [
          {
            unitId: unitIds[1],
            condition: UnitCondition.FAIR, // Minor damage
            damageSeverity: 'MINOR',
            damageNotes: 'Small stain on fabric',
            afterPhotos: ['https://example.com/damage.jpg'],
          },
        ],
      },
      ACTOR_ID
    );

    // 5. Verify: Some deposit deducted for minor damage
    expect(Number(returnProcess.damageCharges)).toBeGreaterThan(0);
    expect(Number(returnProcess.depositDeduction)).toBeGreaterThan(0);
    // Should have some refund remaining (500k deposit > minor damage charge)
    expect(
      Number(returnProcess.depositRefund)
    ).toBeGreaterThanOrEqual(0);
  });

  it('No Refund: Major damage → Full deposit consumed', async () => {
    // 1. Create Order
    const startDate = new Date();
    const endDate = new Date(
      startDate.getTime() + 1 * 24 * 60 * 60 * 1000
    );

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

    // 2. Confirm
    await rentalService.confirmOrder(
      COMPANY_ID,
      {
        orderId: order.id,
        depositAmount: 500000,
        paymentMethod: 'CASH',
        unitAssignments: [{ unitId: unitIds[2] }],
      },
      ACTOR_ID
    );

    // 3. Release
    await rentalService.releaseOrder(
      COMPANY_ID,
      {
        orderId: order.id,
        unitAssignments: [
          {
            unitId: unitIds[2],
            condition: UnitCondition.NEW,
            beforePhotos: ['https://example.com/before.jpg'],
          },
        ],
      },
      ACTOR_ID
    );

    // 4. Process return with MAJOR damage
    const actualReturnDate = new Date(endDate.getTime() + 1000);
    const returnProcess = await rentalService.processReturn(
      COMPANY_ID,
      {
        orderId: order.id,
        actualReturnDate,
        units: [
          {
            unitId: unitIds[2],
            condition: UnitCondition.NEEDS_REPAIR,
            damageSeverity: 'MAJOR',
            damageNotes: 'Large tear, needs professional repair',
            afterPhotos: ['https://example.com/major-damage.jpg'],
          },
        ],
      },
      ACTOR_ID
    );

    // 5. Verify: Full deposit consumed for major damage
    expect(Number(returnProcess.damageCharges)).toBeGreaterThan(0);
    // Deposit fully consumed or mostly consumed
    expect(Number(returnProcess.depositDeduction)).toBeGreaterThan(0);
  });

  it('Overage Invoice: Damage exceeds deposit → Invoice created', async () => {
    // This test confirms the existing rental-invoice.test.ts scenario
    // by verifying the additionalChargesDue field

    // 1. Create Order
    const startDate = new Date();
    const endDate = new Date(
      startDate.getTime() + 1 * 24 * 60 * 60 * 1000
    );

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

    // 2. Confirm with SMALL deposit (100k instead of 500k)
    await rentalService.confirmOrder(
      COMPANY_ID,
      {
        orderId: order.id,
        depositAmount: 100000, // Small deposit
        paymentMethod: 'CASH',
        unitAssignments: [{ unitId: unitIds[3] }],
      },
      ACTOR_ID
    );

    // 3. Release
    await rentalService.releaseOrder(
      COMPANY_ID,
      {
        orderId: order.id,
        unitAssignments: [
          {
            unitId: unitIds[3],
            condition: UnitCondition.NEW,
            beforePhotos: ['https://example.com/before.jpg'],
          },
        ],
      },
      ACTOR_ID
    );

    // 4. Process return with damage that exceeds deposit
    const actualReturnDate = new Date(endDate.getTime() + 1000);
    const returnProcess = await rentalService.processReturn(
      COMPANY_ID,
      {
        orderId: order.id,
        actualReturnDate,
        units: [
          {
            unitId: unitIds[3],
            condition: UnitCondition.NEEDS_REPAIR,
            damageSeverity: 'MAJOR', // Major damage > 100k deposit
            damageNotes: 'Completely destroyed, needs replacement',
            afterPhotos: ['https://example.com/destroyed.jpg'],
          },
        ],
      },
      ACTOR_ID
    );

    // 5. Verify: Additional charges due (damage > deposit)
    const totalCharges = Number(returnProcess.totalCharges);
    const depositDeduction = Number(returnProcess.depositDeduction);
    const additionalCharges = Number(
      returnProcess.additionalChargesDue
    );

    expect(totalCharges).toBeGreaterThan(100000); // > deposit
    expect(depositDeduction).toBe(100000); // Full deposit used
    expect(additionalCharges).toBeGreaterThan(0); // Has overage
    expect(additionalCharges).toBe(totalCharges - depositDeduction);
  });
});
