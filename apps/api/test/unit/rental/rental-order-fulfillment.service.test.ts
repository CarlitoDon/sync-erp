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
import { DomainError, asMock, ManualConfirmRentalOrderInput } from '@sync-erp/shared';
import { Decimal } from 'decimal.js';
// No local mock for @sync-erp/database needed, relying on global setup

describe('RentalOrderFulfillmentService', () => {
  let service: RentalOrderFulfillmentService;
  const COMPANY_ID = 'test-company-id';
  const ACTOR_ID = 'test-actor-id';

  beforeEach(() => {
    resetRepositoryMocks();
    resetServiceMocks();
    vi.clearAllMocks();

    service = new RentalOrderFulfillmentService(
      mockRentalRepository as unknown as import("../../../src/modules/rental/rental.repository").RentalRepository,
      mockJournalService as unknown as import("../../../src/modules/accounting/services/journal.service").JournalService
    );
    asMock(prisma.companySubscription.findUnique).mockResolvedValue({
      planKey: 'starter',
    });
    asMock(prisma.rentalOrder.updateMany).mockResolvedValue({ count: 1 });
    asMock(prisma.rentalOrder.findUniqueOrThrow).mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({
        id: where.id,
        companyId: COMPANY_ID,
        status: RentalOrderStatus.CONFIRMED,
        unitAssignments: [{ rentalItemUnitId: 'unit-1' }],
        items: [],
        deposit: null,
      })
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
        mockOrder as unknown as import("@sync-erp/shared").PrismaRentalOrderWithRelations
      );

      // Mock order items
      asMock(prisma.rentalOrderItem.findMany).mockResolvedValue([
        {
          rentalItemId: 'item-1',
          quantity: 1,
          rentalBundleId: null,
        },
      ]);

      // Mock available units
      asMock(prisma.rentalItemUnit.findMany).mockResolvedValue([
        { id: 'unit-1', status: UnitStatus.AVAILABLE },
      ]);
      asMock(prisma.rentalItemUnit.updateMany).mockResolvedValue({
        count: 1,
      });

      mockRentalRepository.getCurrentPolicy.mockResolvedValue({
        defaultDepositPolicyType: DepositPolicyType.PER_UNIT,
      } as never);

      asMock(prisma.rentalDeposit.create).mockResolvedValue({
        id: 'deposit-1',
        amount: new Decimal(50000),
      });

      asMock(prisma.rentalOrder.update).mockResolvedValue({
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
      expect(mockJournalService.postRentalDownPayment).toHaveBeenCalled();
      expect(prisma.rentalOrder.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentMethod: 'BANK',
          }),
        })
      );
      expect(prisma.rentalItemUnit.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: UnitStatus.RESERVED },
        })
      );
    });

    it('should resolve CompanyPaymentMethod and pass mapped accountId to journal posting in confirmOrder', async () => {
      mockRentalRepository.findOrderById.mockResolvedValue(
        mockOrder as unknown as import("@sync-erp/shared").PrismaRentalOrderWithRelations
      );
      asMock(prisma.rentalOrderItem.findMany).mockResolvedValue([
        { rentalItemId: 'item-1', quantity: 1, rentalBundleId: null },
      ]);
      asMock(prisma.rentalItemUnit.findMany).mockResolvedValue([
        { id: 'unit-1', status: UnitStatus.AVAILABLE },
      ]);
      asMock(prisma.rentalItemUnit.updateMany).mockResolvedValue({ count: 1 });
      mockRentalRepository.getCurrentPolicy.mockResolvedValue({
        defaultDepositPolicyType: DepositPolicyType.PER_UNIT,
      } as never);
      asMock(prisma.rentalDeposit.create).mockResolvedValue({
        id: 'deposit-1',
        amount: new Decimal(50000),
      });
      asMock(prisma.rentalOrderUnitAssignment.createMany).mockResolvedValue({ count: 1 });
      asMock(prisma.companyPaymentMethod.findFirst).mockResolvedValue({
        id: 'pm-qris',
        code: 'QRIS_JAGO',
        type: 'QRIS',
        accountId: 'acc-1055',
        account: { id: 'acc-1055', code: '1055', name: 'Bank Jago Mila' },
      });

      await service.confirmOrder(
        COMPANY_ID,
        {
          orderId: 'order-1',
          paymentMethodId: 'pm-qris',
          paymentReference: 'QRIS-REF-99',
          unitAssignments: [],
        },
        ACTOR_ID
      );

      expect(mockJournalService.postRentalDownPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentAccountId: 'acc-1055',
          paymentMethod: 'QRIS_JAGO',
        })
      );
      expect(prisma.rentalOrder.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentMethod: 'QRIS_JAGO',
            paymentReference: 'QRIS-REF-99',
          }),
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
      } as never);

      await expect(
        service.confirmOrder(COMPANY_ID, input, ACTOR_ID)
      ).rejects.toThrow('Only DRAFT orders can be confirmed');
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
      accountingTreatment: 'POST_CASH_JOURNAL' as const,
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
        mockOrder as unknown as import("@sync-erp/shared").PrismaRentalOrderWithRelations
      );
      asMock(prisma.companyPaymentMethod.findFirst).mockResolvedValue(mockPaymentMethod);
    });

    it('should manually confirm order successfully', async () => {
      // Mock order items
      asMock(prisma.rentalOrderItem.findMany).mockResolvedValue([
        {
          rentalItemId: 'item-1',
          quantity: 1,
          rentalBundleId: null,
        },
      ]);

      // Mock available units
      asMock(prisma.rentalItemUnit.findMany).mockResolvedValue([
        { id: 'unit-1', status: UnitStatus.AVAILABLE },
      ]);
      asMock(prisma.rentalItemUnit.updateMany).mockResolvedValue({
        count: 1,
      });

      mockRentalRepository.getCurrentPolicy.mockResolvedValue({
        defaultDepositPolicyType: DepositPolicyType.PER_UNIT,
      } as never);

      asMock(prisma.rentalDeposit.create).mockResolvedValue({
        id: 'deposit-1',
        amount: new Decimal(50000),
      });

      asMock(prisma.rentalOrderUnitAssignment.createMany).mockResolvedValue({ count: 1 });

      asMock(prisma.rentalOrder.update).mockResolvedValue({
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
      expect(mockJournalService.postRentalDownPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: COMPANY_ID,
          orderId: 'order-1',
          orderNumber: 'ORD-001',
          downPaymentAmount: 50000,
          paymentMethod: 'BANK',
        })
      );
      expect(prisma.rentalOrder.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentMethod: 'BANK',
            paymentReference: 'REF-123',
          }),
        })
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: COMPANY_ID,
            actorId: ACTOR_ID,
            payloadSnapshot: expect.objectContaining({
              accountingTreatment: 'POST_CASH_JOURNAL',
              journalPosted: true,
            }),
          }),
        })
      );
    });

    it('should manually confirm order without posting journal when accountingTreatment is OPENING_BALANCE_NO_POSTING', async () => {
      // Mock order items
      asMock(prisma.rentalOrderItem.findMany).mockResolvedValue([
        {
          rentalItemId: 'item-1',
          quantity: 1,
          rentalBundleId: null,
        },
      ]);

      // Mock available units
      asMock(prisma.rentalItemUnit.findMany).mockResolvedValue([
        { id: 'unit-1', status: UnitStatus.AVAILABLE },
      ]);
      asMock(prisma.rentalItemUnit.updateMany).mockResolvedValue({
        count: 1,
      });

      mockRentalRepository.getCurrentPolicy.mockResolvedValue({
        defaultDepositPolicyType: DepositPolicyType.PER_UNIT,
      } as never);

      asMock(prisma.rentalDeposit.create).mockResolvedValue({
        id: 'deposit-1',
        amount: new Decimal(50000),
      });

      asMock(prisma.rentalOrderUnitAssignment.createMany).mockResolvedValue({ count: 1 });

      asMock(prisma.rentalOrder.update).mockResolvedValue({
        ...mockOrder,
        status: RentalOrderStatus.CONFIRMED,
        depositAmount: new Decimal(50000),
      });

      const openingBalanceInput: ManualConfirmRentalOrderInput = {
        ...input,
        accountingTreatment: 'OPENING_BALANCE_NO_POSTING',
      };

      const result = await service.manualConfirmOrder(
        COMPANY_ID,
        openingBalanceInput,
        ACTOR_ID
      );

      expect(result.status).toBe(RentalOrderStatus.CONFIRMED);
      expect(prisma.rentalDeposit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: expect.objectContaining({ d: [50000] }),
            paymentMethod: 'BANK',
            paymentReference: 'REF-123',
          }),
        })
      );
      expect(prisma.rentalOrderUnitAssignment.createMany).toHaveBeenCalled();
      expect(prisma.rentalItemUnit.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['unit-1'] },
          status: { notIn: [UnitStatus.MAINTENANCE, UnitStatus.RETIRED] },
        },
        data: { status: UnitStatus.RESERVED },
      });
      expect(prisma.rentalOrder.updateMany).toHaveBeenCalled();
      expect(mockJournalService.postRentalDownPayment).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: COMPANY_ID,
            actorId: ACTOR_ID,
            payloadSnapshot: expect.objectContaining({
              accountingTreatment: 'OPENING_BALANCE_NO_POSTING',
              journalPosted: false,
            }),
          }),
        })
      );
    });

    it('should skip stock check if requested', async () => {
      const skipInput = { ...input, skipStockCheck: true };

      // Mock order items
      asMock(prisma.rentalOrderItem.findMany).mockResolvedValue([
        {
          rentalItemId: 'item-1',
          quantity: 10, // Require 10
          rentalBundleId: null,
        },
      ]);

      // Mock available units (only 1 available)
      asMock(prisma.rentalItemUnit.findMany).mockResolvedValue([
        { id: 'unit-1', status: UnitStatus.AVAILABLE },
      ]);

      // It should proceed despite insufficient stock
      asMock(prisma.rentalItemUnit.updateMany).mockResolvedValue({
        count: 1,
      });

      mockRentalRepository.getCurrentPolicy.mockResolvedValue(null); // Should create policy
      asMock(prisma.rentalPolicy.create).mockResolvedValue({
        defaultDepositPolicyType: DepositPolicyType.PER_UNIT,
      });

      asMock(prisma.rentalDeposit.create).mockResolvedValue({
        id: 'deposit-1',
      });
      asMock(prisma.rentalOrder.update).mockResolvedValue({
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
      asMock(prisma.companyPaymentMethod.findFirst).mockResolvedValue(null);

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
      unitAssignments: [{ rentalItemUnitId: 'unit-1' }],
    };

    it('should release order and update units to RENTED', async () => {
      mockRentalRepository.findOrderById.mockResolvedValue(
        mockOrder as unknown as import("@sync-erp/shared").PrismaRentalOrderWithRelations
      );

      asMock(prisma.itemConditionLog.create).mockResolvedValue({});
      asMock(prisma.rentalItemUnit.updateMany).mockResolvedValue({
        count: 1,
      });
      asMock(prisma.rentalOrder.update).mockResolvedValue({
        ...mockOrder,
        status: RentalOrderStatus.ACTIVE,
      });
      asMock(prisma.rentalOrder.findUniqueOrThrow).mockResolvedValue({
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
        mockOrder as unknown as import("@sync-erp/shared").PrismaRentalOrderWithRelations
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

    it('should release without photos on the free plan', async () => {
      asMock(prisma.companySubscription.findUnique).mockResolvedValue({
        planKey: 'free',
      });
      mockRentalRepository.findOrderById.mockResolvedValue(
        mockOrder as unknown as import("@sync-erp/shared").PrismaRentalOrderWithRelations
      );
      asMock(prisma.itemConditionLog.create).mockResolvedValue({});
      asMock(prisma.rentalItemUnit.updateMany).mockResolvedValue({
        count: 1,
      });
      asMock(prisma.rentalOrder.update).mockResolvedValue({
        ...mockOrder,
        status: RentalOrderStatus.ACTIVE,
      });
      asMock(prisma.rentalOrder.findUniqueOrThrow).mockResolvedValue({
        ...mockOrder,
        status: RentalOrderStatus.ACTIVE,
      });

      const result = await service.releaseOrder(
        COMPANY_ID,
        {
          ...input,
          unitAssignments: [
            { ...input.unitAssignments[0], beforePhotos: [] },
          ],
        },
        ACTOR_ID
      );

      expect(result.status).toBe(RentalOrderStatus.ACTIVE);
      expect(prisma.itemConditionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            beforePhotos: [],
            notes: 'No damage',
          }),
        })
      );
    });

    it('should reject submitted photos on the free plan', async () => {
      asMock(prisma.companySubscription.findUnique).mockResolvedValue({
        planKey: 'free',
      });
      mockRentalRepository.findOrderById.mockResolvedValue(
        mockOrder as unknown as import("@sync-erp/shared").PrismaRentalOrderWithRelations
      );

      await expect(
        service.releaseOrder(COMPANY_ID, input, ACTOR_ID)
      ).rejects.toThrow(
        'Media access is not available on your current plan'
      );
    });
  });
});
