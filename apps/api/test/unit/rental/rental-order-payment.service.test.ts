import {
  describe,
  expect,
  it,
  beforeEach,
  vi,
  afterEach,
} from 'vitest';
import { RentalOrderPaymentService } from '@modules/rental/rental-order-payment.service';
import { RentalWebhookService } from '@modules/rental/rental-webhook.service';
import {
  prisma,
  RentalOrderStatus,
  RentalPaymentStatus,
  OrderSource,
} from '@sync-erp/database';

// Mock dependencies
vi.mock('@modules/common/audit/audit-log.service', () => ({
  recordAudit: vi.fn(),
  hasAuditedAction: vi.fn(),
  getAuditTrail: vi.fn(),
}));

// Auto-mock the module containing the class
vi.mock('@modules/rental/rental-webhook.service');

describe('RentalOrderPaymentService', () => {
  let service: RentalOrderPaymentService;
  let mockWebhookService: any;
  const COMPANY_ID = 'test-company-id';
  const ACTOR_ID = 'test-actor-id';
  const ORDER_ID = 'order-1';

  beforeEach(() => {
    vi.clearAllMocks();

    // Configure the mock class constructor to return an object with mocked methods
    const MockRentalWebhookService = vi.mocked(RentalWebhookService);
    MockRentalWebhookService.mockClear();

    // Use a standard function so it can be used as a constructor
    MockRentalWebhookService.mockImplementation(function () {
      return {
        notifyPaymentStatus: vi.fn().mockResolvedValue(undefined),
        notifyNewOrder: vi.fn().mockResolvedValue(undefined),
        notifyOrderCreated: vi.fn().mockResolvedValue(undefined),
        notifyOrderCancelled: vi.fn().mockResolvedValue(undefined),
      } as any;
    });

    mockWebhookService = new RentalWebhookService();
    service = new RentalOrderPaymentService(mockWebhookService);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const mockOrder = {
    id: ORDER_ID,
    companyId: COMPANY_ID,
    rentalPaymentStatus: RentalPaymentStatus.AWAITING_CONFIRM,
    status: RentalOrderStatus.DRAFT,
    orderSource: OrderSource.ADMIN,
    publicToken: 'token-123',
  };

  describe('verifyPayment', () => {
    it('should confirm payment successfully', async () => {
      (prisma.rentalOrder.findUnique as any).mockResolvedValue(
        mockOrder
      );
      (prisma.rentalOrder.update as any).mockResolvedValue({
        ...mockOrder,
        rentalPaymentStatus: RentalPaymentStatus.CONFIRMED,
      });

      const result = await service.verifyPayment(
        COMPANY_ID,
        ORDER_ID,
        'confirm',
        ACTOR_ID,
        'REF-001'
      );

      expect(result.rentalPaymentStatus).toBe(
        RentalPaymentStatus.CONFIRMED
      );
      expect(prisma.rentalOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rentalPaymentStatus: RentalPaymentStatus.CONFIRMED,
            paymentReference: 'REF-001',
          }),
        })
      );

      // Check if the webhook method was called
      expect(
        mockWebhookService.notifyPaymentStatus
      ).toHaveBeenCalledWith({
        token: 'token-123',
        action: 'confirmed',
        paymentReference: 'REF-001',
        failReason: undefined,
      });
    });

    it('should auto-confirm order if WEBSITE and DRAFT', async () => {
      const websiteOrder = {
        ...mockOrder,
        orderSource: OrderSource.WEBSITE,
        status: RentalOrderStatus.DRAFT,
      };
      (prisma.rentalOrder.findUnique as any).mockResolvedValue(
        websiteOrder
      );
      (prisma.rentalOrder.update as any).mockResolvedValue({
        ...websiteOrder,
        rentalPaymentStatus: RentalPaymentStatus.CONFIRMED,
        status: RentalOrderStatus.CONFIRMED,
      });

      const result = await service.verifyPayment(
        COMPANY_ID,
        ORDER_ID,
        'confirm',
        ACTOR_ID
      );

      expect(result.status).toBe(RentalOrderStatus.CONFIRMED);
      expect(prisma.rentalOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: RentalOrderStatus.CONFIRMED,
          }),
        })
      );
    });

    it('should NOT auto-confirm order if ADMIN', async () => {
      const adminOrder = {
        ...mockOrder,
        orderSource: OrderSource.ADMIN,
        status: RentalOrderStatus.DRAFT,
      };
      (prisma.rentalOrder.findUnique as any).mockResolvedValue(
        adminOrder
      );
      (prisma.rentalOrder.update as any).mockResolvedValue({
        ...adminOrder,
        rentalPaymentStatus: RentalPaymentStatus.CONFIRMED,
        status: RentalOrderStatus.DRAFT, // Remains draft
      });

      const result = await service.verifyPayment(
        COMPANY_ID,
        ORDER_ID,
        'confirm',
        ACTOR_ID
      );

      expect(result.status).toBe(RentalOrderStatus.DRAFT);
      expect(prisma.rentalOrder.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: RentalOrderStatus.CONFIRMED,
          }),
        })
      );
    });

    it('should reject payment successfully', async () => {
      (prisma.rentalOrder.findUnique as any).mockResolvedValue(
        mockOrder
      );
      (prisma.rentalOrder.update as any).mockResolvedValue({
        ...mockOrder,
        rentalPaymentStatus: RentalPaymentStatus.FAILED,
      });

      const result = await service.verifyPayment(
        COMPANY_ID,
        ORDER_ID,
        'reject',
        ACTOR_ID,
        undefined,
        'Invalid proof'
      );

      expect(result.rentalPaymentStatus).toBe(
        RentalPaymentStatus.FAILED
      );
      expect(prisma.rentalOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rentalPaymentStatus: RentalPaymentStatus.FAILED,
            paymentFailReason: 'Invalid proof',
          }),
        })
      );

      expect(
        mockWebhookService.notifyPaymentStatus
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'rejected',
          failReason: 'Invalid proof',
        })
      );
    });

    it('should throw if order not found', async () => {
      (prisma.rentalOrder.findUnique as any).mockResolvedValue(null);

      await expect(
        service.verifyPayment(
          COMPANY_ID,
          ORDER_ID,
          'confirm',
          ACTOR_ID
        )
      ).rejects.toThrow('Order not found');
    });

    it('should throw if status is not AWAITING_CONFIRM', async () => {
      (prisma.rentalOrder.findUnique as any).mockResolvedValue({
        ...mockOrder,
        rentalPaymentStatus: RentalPaymentStatus.CONFIRMED,
      });

      await expect(
        service.verifyPayment(
          COMPANY_ID,
          ORDER_ID,
          'confirm',
          ACTOR_ID
        )
      ).rejects.toThrow(
        'Only payments with AWAITING_CONFIRM status can be verified'
      );
    });
  });
});
