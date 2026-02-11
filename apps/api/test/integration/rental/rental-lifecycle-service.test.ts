import {
  describe,
  expect,
  it,
  beforeAll,
  afterAll,
  vi,
} from 'vitest';
import {
  prisma,
  RentalOrderStatus,
  AuditLogAction,
  EntityType,
} from '@sync-erp/database';
import { RentalOrderLifecycleService } from '@modules/rental/rental-order-lifecycle.service';
import { RentalRepository } from '@modules/rental/rental.repository';
import { RentalService } from '@modules/rental/rental.service';
import { DocumentNumberService } from '@modules/common/services/document-number.service';
import { JournalService } from '@modules/accounting/services/journal.service';
import { RentalWebhookService } from '@modules/rental/rental-webhook.service';

const rentalServiceFacade = new RentalService(); // For setup helper
const repository = new RentalRepository();
const documentNumberService = new DocumentNumberService();
const journalService = new JournalService();

// Mock Webhook Service
const mockWebhookService = {
  notifyPaymentStatus: vi.fn(),
  notifyNewOrder: vi.fn(),
  notifyOrderCreated: vi.fn(),
  notifyOrderCancelled: vi.fn(),
} as unknown as RentalWebhookService;

const service = new RentalOrderLifecycleService(
  repository,
  documentNumberService,
  journalService,
  mockWebhookService
);

const COMPANY_ID = 'test-rental-lifecycle-int-001';
const ACTOR_ID = 'test-user-system';

describe('RentalOrderLifecycleService Integration', () => {
  let productId: string;
  let rentalItemId: string;
  let partnerId: string;
  let createdOrderId: string;

  beforeAll(async () => {
    // Cleanup
    await prisma.$transaction([
      prisma.auditLog.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.rentalOrderItem.deleteMany({
        where: { rentalOrder: { companyId: COMPANY_ID } },
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

    // Setup
    await prisma.company.create({
      data: { id: COMPANY_ID, name: 'Test Rental Lifecycle Company' },
    });

    const partner = await prisma.partner.create({
      data: {
        companyId: COMPANY_ID,
        name: 'Test Customer',
        type: 'CUSTOMER',
        email: 'test-customer@example.com',
      },
    });
    partnerId = partner.id;

    const product = await prisma.product.create({
      data: {
        companyId: COMPANY_ID,
        sku: 'RNT-ITEM-001',
        name: 'Rental Generator',
        price: 5000000,
        stockQty: 10,
        averageCost: 4000000,
      },
    });
    productId = product.id;

    const rentalItem = await rentalServiceFacade.createItem(
      COMPANY_ID,
      {
        productId,
        dailyRate: 100000,
        weeklyRate: 600000,
        monthlyRate: 2000000,
        depositPolicyType: 'PER_UNIT',
        depositPerUnit: 500000,
      },
      ACTOR_ID
    );
    rentalItemId = rentalItem.id;

    // Policy (Optional, but good practice)
    await rentalServiceFacade.updatePolicy(
      COMPANY_ID,
      {
        gracePeriodHours: 24,
        lateFeeDailyRate: 50000,
        cleaningFee: 0,
        pickupGracePeriodHours: 24,
      },
      ACTOR_ID
    );
  });

  afterAll(async () => {
    // Final Cleanup
    await prisma.$transaction([
      prisma.auditLog.deleteMany({
        where: { companyId: COMPANY_ID },
      }),
      prisma.rentalOrderItem.deleteMany({
        where: { rentalOrder: { companyId: COMPANY_ID } },
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
  });

  it('should create a rental order properly', async () => {
    const startDate = new Date();
    const endDate = new Date(
      startDate.getTime() + 3 * 24 * 60 * 60 * 1000
    ); // 3 days

    const order = await service.createOrder(
      COMPANY_ID,
      {
        partnerId,
        rentalStartDate: startDate,
        rentalEndDate: endDate,
        items: [
          {
            rentalItemId,
            quantity: 1,
          },
        ],
        notes: 'Integration Test Order',
      },
      ACTOR_ID
    );

    createdOrderId = order.id;

    expect(order).toBeDefined();
    expect(order.orderNumber).toMatch(/^RNT-/);
    expect(order.status).toBe(RentalOrderStatus.DRAFT);
    expect(order.items).toHaveLength(1);
    expect(Number(order.totalAmount)).toBe(300000); // 3 * 100k

    // Verify Audit Log
    const log = await prisma.auditLog.findFirst({
      where: {
        companyId: COMPANY_ID,
        entityType: EntityType.RENTAL_ORDER,
        entityId: order.id,
        action: AuditLogAction.RENTAL_ORDER_CREATED,
      },
    });
    expect(log).toBeDefined();

    // Verify Webhook called
    expect(
      mockWebhookService.notifyOrderCreated
    ).toHaveBeenCalledWith(expect.objectContaining({ id: order.id }));
  });

  it('should cancel the created rental order', async () => {
    const cancelledOrder = await service.cancelOrder(
      COMPANY_ID,
      createdOrderId,
      'Test Cancellation',
      ACTOR_ID
    );

    expect(cancelledOrder.status).toBe(RentalOrderStatus.CANCELLED);
    expect(cancelledOrder.notes).toContain(
      '[Cancelled: Test Cancellation]'
    );

    // Verify DB
    const dbOrder = await prisma.rentalOrder.findUnique({
      where: { id: createdOrderId },
    });
    expect(dbOrder?.status).toBe(RentalOrderStatus.CANCELLED);

    // Verify Audit Log
    const log = await prisma.auditLog.findFirst({
      where: {
        companyId: COMPANY_ID,
        entityType: EntityType.RENTAL_ORDER,
        entityId: createdOrderId,
        action: AuditLogAction.RENTAL_ORDER_CANCELLED,
      },
    });
    expect(log).toBeDefined();
    expect(log?.payloadSnapshot).toMatchObject({
      reason: 'Test Cancellation',
    });

    // Verify Webhook called
    expect(
      mockWebhookService.notifyOrderCancelled
    ).toHaveBeenCalledWith(
      expect.objectContaining({ id: createdOrderId })
    );
  });
});
