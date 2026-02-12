import { describe, expect, it, beforeEach, vi } from 'vitest';
import { RentalOrderFulfillmentService } from '@modules/rental/rental-order-fulfillment.service';
import {
  mockRentalRepository,
  resetRepositoryMocks,
} from '../mocks/repositories.mock';
import {
  mockJournalService,
  resetServiceMocks,
} from '../mocks/services.mock';
import {
  prisma,
  RentalOrderStatus,
  DepositPolicyType,
  UnitStatus,
  DepositStatus,
  PaymentMethodType,
  UnitCondition,
} from '@sync-erp/database';
import { DomainError } from '@sync-erp/shared';
import { Decimal } from 'decimal.js';

// No local mock for @sync-erp/database needed, relying on global setup

// Mock audit log
vi.mock('@modules/common/audit/audit-log.service', () => ({
  recordAudit: vi.fn(),
}));

describe('RentalOrderFulfillmentService', () => {
  let service: RentalOrderFulfillmentService;
  const COMPANY_ID = 'test-company-id';
  const ACTOR_ID = 'test-actor-id';

  beforeEach(() => {
    resetRepositoryMocks();
    resetServiceMocks();
    vi.clearAllMocks();

    service = new RentalOrderFulfillmentService(
      mockRentalRepository as any,
      mockJournalService as any
    );
  });

  describe('confirmOrder', () => {
    const input = {
      orderId: 'order-1',
      unitAssignments: [],
    };

    const mockOrder = {
      id: 'order-1',
      companyId: COMPANY_ID,
      orderNumber: 'ORD-001',
      status: RentalOrderStatus.DRAFT,
      totalAmount: new Decimal(100000),
      depositAmount: new Decimal(50000),
      paymentMethod: PaymentMethodType.BANK,
    };

    it('should confirm order successfully with auto-assigned units', async () => {
      mockRentalRepository.findOrderById.mockResolvedValue(
        mockOrder as any
      );

      // Mock order items
      (prisma.rentalOrderItem.findMany as any).mockResolvedValue([
        {
          rentalItemId: 'item-1',
          quantity: 1,
          rentalBundleId: null,
        },
      ]);

      // Mock available units
      (prisma.rentalItemUnit.findMany as any).mockResolvedValue([
        { id: 'unit-1', status: UnitStatus.AVAILABLE },
      ]);
      (prisma.rentalItemUnit.updateMany as any).mockResolvedValue({
        count: 1,
      });

      mockRentalRepository.getCurrentPolicy.mockResolvedValue({
        defaultDepositPolicyType: DepositPolicyType.PER_UNIT,
      } as any);

      (prisma.rentalDeposit.create as any).mockResolvedValue({
        id: 'deposit-1',
        amount: new Decimal(50000),
      });

      (prisma.rentalOrder.update as any).mockResolvedValue({
        ...mockOrder,
        status: RentalOrderStatus.CONFIRMED,
      });

      const result = await service.confirmOrder(
        COMPANY_ID,
        input,
        ACTOR_ID
      );

      expect(result.status).toBe(RentalOrderStatus.CONFIRMED);
      expect(prisma.rentalDeposit.create).toHaveBeenCalled();
      expect(mockJournalService.postRentalDeposit).toHaveBeenCalled();
      expect(prisma.rentalItemUnit.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: UnitStatus.RESERVED },
        })
      );
    });

    it('should throw if order not found', async () => {
      mockRentalRepository.findOrderById.mockResolvedValue(null);

      await expect(
        service.confirmOrder(COMPANY_ID, input, ACTOR_ID)
      ).rejects.toThrow(DomainError);
    });

    it('should throw if order not DRAFT', async () => {
      mockRentalRepository.findOrderById.mockResolvedValue({
        ...mockOrder,
        status: RentalOrderStatus.CONFIRMED,
      } as any);

      await expect(
        service.confirmOrder(COMPANY_ID, input, ACTOR_ID)
      ).rejects.toThrow('Can only confirm DRAFT orders');
    });
  });

  describe('manualConfirmOrder', () => {
    const input = {
      orderId: 'order-1',
      paymentMethodId: 'pm-1',
      paymentAmount: 50000,
      paymentReference: 'REF-123',
      notes: 'Manual confirm',
      skipStockCheck: false,
    };

    const mockOrder = {
      id: 'order-1',
      companyId: COMPANY_ID,
      orderNumber: 'ORD-001',
      status: RentalOrderStatus.DRAFT,
      totalAmount: new Decimal(100000),
      depositAmount: new Decimal(0),
    };

    const mockPaymentMethod = {
      id: 'pm-1',
      code: 'BANK',
      name: 'Bank Transfer',
    };

    beforeEach(() => {
      mockRentalRepository.findOrderById.mockResolvedValue(
        mockOrder as any
      );
      (
        prisma.companyPaymentMethod.findFirst as any
      ).mockResolvedValue(mockPaymentMethod);
    });

    it('should manually confirm order successfully', async () => {
      // Mock order items
      (prisma.rentalOrderItem.findMany as any).mockResolvedValue([
        {
          rentalItemId: 'item-1',
          quantity: 1,
          rentalBundleId: null,
        },
      ]);

      // Mock available units
      (prisma.rentalItemUnit.findMany as any).mockResolvedValue([
        { id: 'unit-1', status: UnitStatus.AVAILABLE },
      ]);
      (prisma.rentalItemUnit.updateMany as any).mockResolvedValue({
        count: 1,
      });

      mockRentalRepository.getCurrentPolicy.mockResolvedValue({
        defaultDepositPolicyType: DepositPolicyType.PER_UNIT,
      } as any);

      (prisma.rentalDeposit.create as any).mockResolvedValue({
        id: 'deposit-1',
        amount: new Decimal(50000),
      });

      (
        prisma.rentalOrderUnitAssignment.createMany as any
      ).mockResolvedValue({ count: 1 });

      (prisma.rentalOrder.update as any).mockResolvedValue({
        ...mockOrder,
        status: RentalOrderStatus.CONFIRMED,
        depositAmount: new Decimal(50000),
      });

      const result = await service.manualConfirmOrder(
        COMPANY_ID,
        input,
        ACTOR_ID
      );

      expect(result.status).toBe(RentalOrderStatus.CONFIRMED);
      expect(prisma.rentalDeposit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: expect.objectContaining({ d: [50000] }), // Decimal check
            paymentMethod: 'BANK',
            paymentReference: 'REF-123',
          }),
        })
      );
      expect(mockJournalService.postRentalDeposit).toHaveBeenCalled();
    });

    it('should skip stock check if requested', async () => {
      const skipInput = { ...input, skipStockCheck: true };

      // Mock order items
      (prisma.rentalOrderItem.findMany as any).mockResolvedValue([
        {
          rentalItemId: 'item-1',
          quantity: 10, // Require 10
          rentalBundleId: null,
        },
      ]);

      // Mock available units (only 1 available)
      (prisma.rentalItemUnit.findMany as any).mockResolvedValue([
        { id: 'unit-1', status: UnitStatus.AVAILABLE },
      ]);

      // It should proceed despite insufficient stock
      (prisma.rentalItemUnit.updateMany as any).mockResolvedValue({
        count: 1,
      });

      mockRentalRepository.getCurrentPolicy.mockResolvedValue(null); // Should create policy
      (prisma.rentalPolicy.create as any).mockResolvedValue({
        defaultDepositPolicyType: DepositPolicyType.PER_UNIT,
      });

      (prisma.rentalDeposit.create as any).mockResolvedValue({
        id: 'deposit-1',
      });
      (prisma.rentalOrder.update as any).mockResolvedValue({
        ...mockOrder,
        status: RentalOrderStatus.CONFIRMED,
      });

      await service.manualConfirmOrder(
        COMPANY_ID,
        skipInput,
        ACTOR_ID
      );

      expect(
        prisma.rentalOrderUnitAssignment.createMany
      ).toHaveBeenCalled();
      // Only 1 unit assigned
      expect(prisma.rentalItemUnit.updateMany).toHaveBeenCalled();
    });

    it('should throw if payment method not found', async () => {
      (
        prisma.companyPaymentMethod.findFirst as any
      ).mockResolvedValue(null);

      await expect(
        service.manualConfirmOrder(COMPANY_ID, input, ACTOR_ID)
      ).rejects.toThrow('Payment method not found');
    });
  });

  describe('releaseOrder', () => {
    const input = {
      orderId: 'order-1',
      unitAssignments: [
        {
          unitId: 'unit-1',
          beforePhotos: ['photo1.jpg'],
          condition: UnitCondition.GOOD,
          notes: 'No damage',
        },
      ],
    };

    const mockOrder = {
      id: 'order-1',
      companyId: COMPANY_ID,
      status: RentalOrderStatus.CONFIRMED,
      paymentStatus: 'PAID',
      depositStatus: DepositStatus.COLLECTED,
      depositAmount: new Decimal(50000),
    };

    it('should release order and update units to RENTED', async () => {
      mockRentalRepository.findOrderById.mockResolvedValue(
        mockOrder as any
      );

      (prisma.itemConditionLog.create as any).mockResolvedValue({});
      (prisma.rentalItemUnit.updateMany as any).mockResolvedValue({
        count: 1,
      });
      (prisma.rentalOrder.update as any).mockResolvedValue({
        ...mockOrder,
        status: RentalOrderStatus.ACTIVE,
      });

      const result = await service.releaseOrder(
        COMPANY_ID,
        input,
        ACTOR_ID
      );

      expect(result.status).toBe(RentalOrderStatus.ACTIVE);
      expect(prisma.itemConditionLog.create).toHaveBeenCalled();
      expect(prisma.rentalItemUnit.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: UnitStatus.RENTED },
        })
      );
    });

    it('should throw if photos are missing', async () => {
      mockRentalRepository.findOrderById.mockResolvedValue(
        mockOrder as any
      );

      await expect(
        service.releaseOrder(
          COMPANY_ID,
          {
            ...input,
            unitAssignments: [
              { ...input.unitAssignments[0], beforePhotos: [] },
            ],
          },
          ACTOR_ID
        )
      ).rejects.toThrow('All units must have before photos');
    });
  });
});
