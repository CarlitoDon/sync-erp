import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  prisma,
  RentalOrderStatus,
  RentalPaymentStatus,
  DepositPolicyType,
  OrderSource,
  AccountType,
} from '@sync-erp/database';
import { RentalService } from '@modules/rental/rental.service';

const rentalService = new RentalService();

const COMPANY_ID = 'test-payment-flow-001';
const ACTOR_ID = 'test-user-payment-001';

describe('Rental Payment Flow', () => {
  let rentalItemId: string;
  let customerId: string;
  let productId: string;

  beforeAll(async () => {
    // Clean Setup - order matters for FK constraints
    await prisma.$transaction([
      // 1. Journal (has FK to Account)
      prisma.$executeRaw`DELETE FROM "JournalLine" WHERE "journalId" IN (SELECT id FROM "JournalEntry" WHERE "companyId" = ${COMPANY_ID})`,
      prisma.journalEntry.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      // 2. Inventory (has FK to Product)
      prisma.inventoryMovement.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      // 3. Rental Domain
      prisma.rentalReturn.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.rentalOrderItem.deleteMany({
        where: { rentalOrder: { companyId: COMPANY_ID } },
      }),
      prisma.rentalOrder.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.rentalItemUnit.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.rentalItem.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      // 4. Master Data
      prisma.product.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.partner.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.company.deleteMany({ where: { id: COMPANY_ID } }),
    ]);

    // Create Company
    await prisma.company.create({
      data: {
        id: COMPANY_ID,
        name: 'Payment Flow Test Corp',
      },
    });

    // Seed Chart of Accounts (required for stock conversion)
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

    // Create Default Policy
    await prisma.rentalPolicy.create({
      data: {
        companyId: COMPANY_ID,
        effectiveFrom: new Date(),
        gracePeriodHours: 24,
        cleaningFee: 0,
        lateFeeDailyRate: 50000,
        defaultDepositPolicyType: DepositPolicyType.PER_UNIT,
        defaultDepositPerUnit: 100000,
        pickupGracePeriodHours: 48,
        createdBy: ACTOR_ID,
      },
    });

    // Create Customer
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Payment Test Customer',
        email: 'payment@test.com',
        phone: '628123456789',
        type: 'CUSTOMER',
      },
    });
    customerId = partner.id;

    // Create Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: `KASUR-${Date.now()}`,
        name: 'Kasur Busa King Size',
        price: 2000000,
      },
    });
    productId = product.id;

    // Create Rental Item
    const item = await rentalService.createItem(
      COMPANY_ID,
      {
        productId: productId,
        dailyRate: 50000,
        weeklyRate: 300000,
        monthlyRate: 1000000,
        depositPolicyType: DepositPolicyType.PER_UNIT,
        depositPerUnit: 100000,
      },
      ACTOR_ID
    );
    rentalItemId = item.id;

    // Add stock and convert to rental unit
    await prisma.product.update({
      where: { id: productId },
      data: { stockQty: 2, averageCost: 1000000 },
    });

    await rentalService.convertStockToUnits(
      COMPANY_ID,
      item.id,
      2,
      ACTOR_ID
    );
  });

  afterAll(async () => {
    // Cleanup - order matters for FK constraints
    await prisma.$transaction([
      // 1. Journal (has FK to Account)
      prisma.$executeRaw`DELETE FROM "JournalLine" WHERE "journalId" IN (SELECT id FROM "JournalEntry" WHERE "companyId" = ${COMPANY_ID})`,
      prisma.journalEntry.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      // 2. Inventory (has FK to Product)
      prisma.inventoryMovement.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      // 3. Rental Domain
      prisma.rentalReturn.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.rentalOrderItem.deleteMany({
        where: { rentalOrder: { companyId: COMPANY_ID } },
      }),
      prisma.rentalOrder.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.rentalItemUnit.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.rentalItem.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      // 4. Master Data
      prisma.product.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.partner.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.company.deleteMany({ where: { id: COMPANY_ID } }),
    ]);
  });

  it('Happy Path: DRAFT → AWAITING_CONFIRM → CONFIRMED (Payment Verified)', async () => {
    // 1. Create Draft Order (simulating website order)
    const startDate = new Date();
    const endDate = new Date(
      startDate.getTime() + 7 * 24 * 60 * 60 * 1000
    );

    const order = await prisma.rentalOrder.create({
      data: {
        companyId: COMPANY_ID,
        partnerId: customerId,
        orderNumber: `RNT-PAY-${Date.now()}`,
        rentalStartDate: startDate,
        rentalEndDate: endDate,
        dueDateTime: endDate,
        publicToken: crypto.randomUUID(),
        status: RentalOrderStatus.DRAFT,
        rentalPaymentStatus: RentalPaymentStatus.PENDING,
        subtotal: 350000,
        depositAmount: 100000,
        totalAmount: 350000,
        policySnapshot: {},
        orderSource: OrderSource.WEBSITE,
        createdBy: 'test',
        items: {
          create: [
            {
              rentalItemId,
              quantity: 1,
              unitPrice: 50000,
              subtotal: 350000,
              pricingTier: 'DAILY',
            },
          ],
        },
      },
    });

    expect(order.status).toBe(RentalOrderStatus.DRAFT);
    expect(order.rentalPaymentStatus).toBe(
      RentalPaymentStatus.PENDING
    );

    // 2. Customer clicks "I've paid" → AWAITING_CONFIRM
    const claimedOrder = await prisma.rentalOrder.update({
      where: { id: order.id },
      data: {
        rentalPaymentStatus: RentalPaymentStatus.AWAITING_CONFIRM,
        paymentClaimedAt: new Date(),
        paymentMethod: 'transfer',
      },
    });

    expect(claimedOrder.rentalPaymentStatus).toBe(
      RentalPaymentStatus.AWAITING_CONFIRM
    );
    expect(claimedOrder.paymentClaimedAt).toBeDefined();

    // 3. Admin verifies payment → CONFIRMED
    const confirmedOrder = await rentalService.verifyPayment(
      COMPANY_ID,
      order.id,
      'confirm',
      ACTOR_ID,
      'TRF-123456'
    );

    expect(confirmedOrder.rentalPaymentStatus).toBe(
      RentalPaymentStatus.CONFIRMED
    );
    expect(confirmedOrder.paymentConfirmedAt).toBeDefined();
    expect(confirmedOrder.paymentReference).toBe('TRF-123456');
    // Website orders should auto-confirm status
    expect(confirmedOrder.status).toBe(RentalOrderStatus.CONFIRMED);
  });

  it('Rejection Flow: AWAITING_CONFIRM → FAILED (Payment Not Found)', async () => {
    // 1. Create Draft Order
    const startDate = new Date();
    const endDate = new Date(
      startDate.getTime() + 3 * 24 * 60 * 60 * 1000
    );

    const order = await prisma.rentalOrder.create({
      data: {
        companyId: COMPANY_ID,
        partnerId: customerId,
        orderNumber: `RNT-REJ-${Date.now()}`,
        rentalStartDate: startDate,
        rentalEndDate: endDate,
        dueDateTime: endDate,
        publicToken: crypto.randomUUID(),
        status: RentalOrderStatus.DRAFT,
        rentalPaymentStatus: RentalPaymentStatus.AWAITING_CONFIRM,
        paymentClaimedAt: new Date(),
        paymentMethod: 'qris',
        subtotal: 150000,
        depositAmount: 100000,
        totalAmount: 150000,
        policySnapshot: {},
        orderSource: OrderSource.WEBSITE,
        createdBy: 'test',
        items: {
          create: [
            {
              rentalItemId,
              quantity: 1,
              unitPrice: 50000,
              subtotal: 150000,
              pricingTier: 'DAILY',
            },
          ],
        },
      },
    });

    // 2. Admin rejects payment (not found in bank mutation)
    const rejectedOrder = await rentalService.verifyPayment(
      COMPANY_ID,
      order.id,
      'reject',
      ACTOR_ID,
      undefined,
      'Pembayaran tidak ditemukan di mutasi bank'
    );

    expect(rejectedOrder.rentalPaymentStatus).toBe(
      RentalPaymentStatus.FAILED
    );
    expect(rejectedOrder.paymentFailedAt).toBeDefined();
    expect(rejectedOrder.paymentFailReason).toBe(
      'Pembayaran tidak ditemukan di mutasi bank'
    );
    // Order should remain DRAFT (not auto-confirmed on rejection)
    expect(rejectedOrder.status).toBe(RentalOrderStatus.DRAFT);
  });

  it('Edge Case: Cannot verify payment on PENDING status', async () => {
    // 1. Create order with PENDING status (customer hasn't clicked "I've paid")
    const startDate = new Date();
    const endDate = new Date(
      startDate.getTime() + 2 * 24 * 60 * 60 * 1000
    );

    const order = await prisma.rentalOrder.create({
      data: {
        companyId: COMPANY_ID,
        partnerId: customerId,
        orderNumber: `RNT-EDGE-${Date.now()}`,
        rentalStartDate: startDate,
        rentalEndDate: endDate,
        dueDateTime: endDate,
        publicToken: crypto.randomUUID(),
        status: RentalOrderStatus.DRAFT,
        rentalPaymentStatus: RentalPaymentStatus.PENDING,
        subtotal: 100000,
        depositAmount: 100000,
        totalAmount: 100000,
        policySnapshot: {},
        orderSource: OrderSource.WEBSITE,
        createdBy: 'test',
        items: {
          create: [
            {
              rentalItemId,
              quantity: 1,
              unitPrice: 50000,
              subtotal: 100000,
              pricingTier: 'DAILY',
            },
          ],
        },
      },
    });

    // 2. Admin tries to verify PENDING payment → Should fail
    await expect(
      rentalService.verifyPayment(
        COMPANY_ID,
        order.id,
        'confirm',
        ACTOR_ID
      )
    ).rejects.toThrow('AWAITING_CONFIRM');
  });

  it('Edge Case: Double confirmation is idempotent (no error)', async () => {
    // 1. Create and prepare order
    const startDate = new Date();
    const endDate = new Date(
      startDate.getTime() + 5 * 24 * 60 * 60 * 1000
    );

    const order = await prisma.rentalOrder.create({
      data: {
        companyId: COMPANY_ID,
        partnerId: customerId,
        orderNumber: `RNT-IDEM-${Date.now()}`,
        rentalStartDate: startDate,
        rentalEndDate: endDate,
        dueDateTime: endDate,
        publicToken: crypto.randomUUID(),
        status: RentalOrderStatus.DRAFT,
        rentalPaymentStatus: RentalPaymentStatus.AWAITING_CONFIRM,
        paymentClaimedAt: new Date(),
        paymentMethod: 'transfer',
        subtotal: 250000,
        depositAmount: 100000,
        totalAmount: 250000,
        policySnapshot: {},
        orderSource: OrderSource.WEBSITE,
        createdBy: 'test',
        items: {
          create: [
            {
              rentalItemId,
              quantity: 1,
              unitPrice: 50000,
              subtotal: 250000,
              pricingTier: 'DAILY',
            },
          ],
        },
      },
    });

    // 2. First confirmation succeeds
    const firstConfirm = await rentalService.verifyPayment(
      COMPANY_ID,
      order.id,
      'confirm',
      ACTOR_ID
    );
    expect(firstConfirm.rentalPaymentStatus).toBe(
      RentalPaymentStatus.CONFIRMED
    );

    // 3. Second confirmation should fail (already CONFIRMED, not AWAITING)
    await expect(
      rentalService.verifyPayment(
        COMPANY_ID,
        order.id,
        'confirm',
        ACTOR_ID
      )
    ).rejects.toThrow('AWAITING_CONFIRM');
  });
});
