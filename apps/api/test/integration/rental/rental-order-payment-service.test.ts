import {
  describe,
  expect,
  it,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest';
import {
  prisma,
  RentalOrderStatus,
  RentalPaymentStatus,
  OrderSource,
  UnitStatus,
} from '@sync-erp/database';
import { RentalOrderPaymentService } from '@modules/rental/rental-order-payment.service';
import { RentalService } from '@modules/rental/rental.service';
import { RentalWebhookService } from '@modules/rental/rental-webhook.service';

// Mock Webhook Service
const mockWebhookService = {
  notifyPaymentStatus: vi.fn().mockResolvedValue(undefined),
} as unknown as RentalWebhookService;

const service = new RentalOrderPaymentService(mockWebhookService);
const rentalServiceFacade = new RentalService();

const COMPANY_ID = 'test-rental-payment-int-001';
const ACTOR_ID = 'test-user-system';

describe('RentalOrderPaymentService Integration', () => {
  let productId: string;
  let rentalItemId: string;
  let partnerId: string;

  beforeAll(async () => {
    // Cleanup
    await prisma.$transaction([
      prisma.auditLog.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.rentalDeposit.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.payment.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.rentalOrderUnitAssignment.deleteMany({
        where: { rentalOrder: { companyId: COMPANY_ID } },
      }),
      prisma.rentalOrderItem.deleteMany({
        where: { rentalOrder: { companyId: COMPANY_ID } },
      }),
      prisma.rentalOrder.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.rentalItemUnit.deleteMany({
        where: { company: { id: COMPANY_ID } },
      }),
      prisma.rentalItem.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.product.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.companyPaymentMethod.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.partner.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.account.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.company.deleteMany({ where: { id: COMPANY_ID } }),
    ]);

    // Setup Company
    await prisma.company.create({
      data: { id: COMPANY_ID, name: 'Test Rental Payment Company' },
    });

    // Setup Partner
    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Test Payment Customer',
        type: 'CUSTOMER',
      },
    });
    partnerId = partner.id;

    // Setup Product
    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: 'RNT-PAY-001',
        name: 'Payment Test Item',
        price: 1000000,
        stockQty: 10,
        averageCost: 500000,
      },
    });
    productId = product.id;

    // Setup Rental Item
    const rentalItem = await rentalServiceFacade.createItem(
      COMPANY_ID,
      {
        productId,
        dailyRate: 10000,
        weeklyRate: 60000,
        monthlyRate: 250000,
        depositPolicyType: 'PER_UNIT',
        depositPerUnit: 50000,
      },
      ACTOR_ID
    );
    rentalItemId = rentalItem.id;
  });

  beforeEach(async () => {
    // Clean up orders
    await prisma.$transaction([
      prisma.rentalDeposit.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.rentalOrderUnitAssignment.deleteMany({
        where: { rentalOrder: { companyId: COMPANY_ID } },
      }),
      prisma.rentalOrderItem.deleteMany({
        where: { rentalOrder: { companyId: COMPANY_ID } },
      }),
      prisma.rentalOrder.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
    ]);
    vi.clearAllMocks();
  });

  afterAll(async () => {
    // Cleanup
    await prisma.$transaction([
      prisma.auditLog.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.rentalDeposit.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.payment.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.rentalOrderUnitAssignment.deleteMany({
        where: { rentalOrder: { companyId: COMPANY_ID } },
      }),
      prisma.rentalOrderItem.deleteMany({
        where: { rentalOrder: { companyId: COMPANY_ID } },
      }),
      prisma.rentalOrder.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.rentalItemUnit.deleteMany({
        where: { company: { id: COMPANY_ID } },
      }),
      prisma.rentalItem.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.product.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.companyPaymentMethod.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.partner.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.account.deleteMany({ where: { companyId: COMPANY_ID } }),
      prisma.company.deleteMany({ where: { id: COMPANY_ID } }),
    ]);
  });

  it('should confirm payment and update status', async () => {
    // 1. Create Order
    const order = await rentalServiceFacade.createOrder(
      COMPANY_ID,
      {
        partnerId,
        rentalStartDate: new Date(),
        rentalEndDate: new Date(Date.now() + 86400000),
        items: [{ rentalItemId, quantity: 1 }],
      },
      ACTOR_ID
    );

    // 2. Set to AWAITING_CONFIRM (simulate payment attempt)
    // Also set publicToken for webhook test
    await prisma.rentalOrder.update({
      where: { id: order.id },
      data: {
        rentalPaymentStatus: RentalPaymentStatus.AWAITING_CONFIRM,
        publicToken: 'test-token-123',
      },
    });

    // 3. Verify Payment (Confirm)
    const confirmed = await service.verifyPayment(
      COMPANY_ID,
      order.id,
      'confirm',
      ACTOR_ID,
      'REF-PAY-001'
    );

    expect(confirmed.rentalPaymentStatus).toBe(
      RentalPaymentStatus.CONFIRMED
    );
    expect(confirmed.paymentReference).toBe('REF-PAY-001');
    expect(confirmed.paymentConfirmedAt).toBeDefined();

    // Check Webhook
    expect(
      mockWebhookService.notifyPaymentStatus
    ).toHaveBeenCalledWith({
      token: 'test-token-123',
      action: 'confirmed',
      paymentReference: 'REF-PAY-001',
      failReason: undefined,
    });
  });

  it('should auto-confirm order if source is WEBSITE and status DRAFT', async () => {
    // 1. Create Order
    const order = await rentalServiceFacade.createOrder(
      COMPANY_ID,
      {
        partnerId,
        rentalStartDate: new Date(),
        rentalEndDate: new Date(Date.now() + 86400000),
        items: [{ rentalItemId, quantity: 1 }],
      },
      ACTOR_ID
    );

    // 2. Set to AWAITING_CONFIRM and Source WEBSITE
    await prisma.rentalOrder.update({
      where: { id: order.id },
      data: {
        rentalPaymentStatus: RentalPaymentStatus.AWAITING_CONFIRM,
        orderSource: OrderSource.WEBSITE, // Assuming Valid Enum
        publicToken: 'test-token-auto',
      },
    });

    // 3. Verify Payment
    const confirmed = await service.verifyPayment(
      COMPANY_ID,
      order.id,
      'confirm',
      ACTOR_ID,
      'REF-AUTO-001'
    );

    expect(confirmed.rentalPaymentStatus).toBe(
      RentalPaymentStatus.CONFIRMED
    );
    expect(confirmed.status).toBe(RentalOrderStatus.CONFIRMED); // Auto-confirmed!
  });

  it('should reject payment and update status', async () => {
    // 1. Create Order
    const order = await rentalServiceFacade.createOrder(
      COMPANY_ID,
      {
        partnerId,
        rentalStartDate: new Date(),
        rentalEndDate: new Date(Date.now() + 86400000),
        items: [{ rentalItemId, quantity: 1 }],
      },
      ACTOR_ID
    );

    // 2. Set to AWAITING_CONFIRM
    await prisma.rentalOrder.update({
      where: { id: order.id },
      data: {
        rentalPaymentStatus: RentalPaymentStatus.AWAITING_CONFIRM,
        publicToken: 'test-token-fail',
      },
    });

    // 3. Reject Payment
    const rejected = await service.verifyPayment(
      COMPANY_ID,
      order.id,
      'reject',
      ACTOR_ID,
      undefined,
      'Invalid proof'
    );

    expect(rejected.rentalPaymentStatus).toBe(
      RentalPaymentStatus.FAILED
    );
    expect(rejected.paymentFailReason).toBe('Invalid proof');

    // Check Webhook
    expect(
      mockWebhookService.notifyPaymentStatus
    ).toHaveBeenCalledWith({
      token: 'test-token-fail',
      action: 'rejected',
      paymentReference: undefined,
      failReason: 'Invalid proof',
    });
  });
});
