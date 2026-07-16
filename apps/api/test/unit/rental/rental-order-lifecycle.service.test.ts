import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RentalOrderLifecycleService } from '@modules/rental/rental-order-lifecycle.service';
import {
  mockRentalRepository,
  resetRepositoryMocks,
} from '../mocks/repositories.mock';
import {
  mockDocumentNumberService,
  mockJournalService,
  mockRentalWebhookService,
  resetServiceMocks,
} from '../mocks/services.mock';
import {
  RentalOrderStatus,
  OrderSource,
<<<<<<< HEAD
  Prisma,
=======
>>>>>>> origin/dev
  prisma,
} from '@sync-erp/database';
import { DomainError, asMock } from '@sync-erp/shared';
import { Decimal } from 'decimal.js';

describe('RentalOrderLifecycleService', () => {
  let service: RentalOrderLifecycleService;

  beforeEach(() => {
    resetRepositoryMocks();
    resetServiceMocks();
    vi.clearAllMocks();

    service = new RentalOrderLifecycleService(
<<<<<<< HEAD
      mockRentalRepository as unknown as import("../../../src/modules/rental/rental.repository").RentalRepository,
      mockDocumentNumberService as unknown as import("../../../src/modules/common/services/document-number.service").DocumentNumberService,
      mockJournalService as unknown as import("../../../src/modules/accounting/services/journal.service").JournalService,
      mockRentalWebhookService as unknown as import("../../../src/modules/rental/rental-webhook.service").RentalWebhookService
=======
      mockRentalRepository as unknown as import('../../../src/modules/rental/rental.repository').RentalRepository,
      mockDocumentNumberService as unknown as import('../../../src/modules/common/services/document-number.service').DocumentNumberService,
      mockJournalService as unknown as import('../../../src/modules/accounting/services/journal.service').JournalService,
      mockRentalWebhookService as unknown as import('../../../src/modules/rental/rental-webhook.service').RentalWebhookService
>>>>>>> origin/dev
    );

    // Setup default safe mocks for Prisma
    asMock(prisma.rentalItem.findMany).mockResolvedValue([]);
    asMock(prisma.rentalBundle.findMany).mockResolvedValue([]);
<<<<<<< HEAD
    asMock(prisma.rentalOrderUnitAssignment.findMany).mockResolvedValue([]);
=======
    asMock(
      prisma.rentalOrderUnitAssignment.findMany
    ).mockResolvedValue([]);
>>>>>>> origin/dev
    asMock(prisma.auditLog.create).mockResolvedValue({});
  });

  describe('createOrder', () => {
    // Helper to get fresh input object
    const getValidInput = () => ({
      companyId: 'company-1',
      customerId: 'customer-1',
      rentalStartDate: new Date('2025-01-01'),
      rentalEndDate: new Date('2025-01-03'), // 3 days
      items: [
        {
          productId: 'p1',
          quantity: 1,
          price: 100000,
          rentalItemId: 'item-1',
        },
        {
          productId: 'p2',
          quantity: 2,
          price: 50000,
          rentalItemId: 'item-2',
        },
      ],
      source: OrderSource.ADMIN,
    });

    it('should create an order with valid input', async () => {
      const input = getValidInput();

      // Mock dependencies
      mockDocumentNumberService.generate.mockResolvedValue('RO-001');
      mockDocumentNumberService.generateNextNumber.mockResolvedValue(
        'RO-001'
      );
      mockRentalRepository.getCurrentPolicy.mockResolvedValue(null);

      // Mock Prisma lookups
      asMock(prisma.rentalItem.findMany).mockResolvedValue([
        {
          id: 'item-1',
          dailyRate: new Decimal(100000),
          weeklyRate: new Decimal(600000),
          monthlyRate: new Decimal(2000000),
        },
        {
          id: 'item-2',
          dailyRate: new Decimal(50000),
          weeklyRate: new Decimal(300000),
          monthlyRate: new Decimal(1000000),
        },
      ]);
      asMock(prisma.rentalBundle.findMany).mockResolvedValue([]);

      mockRentalRepository.createRentalOrder.mockResolvedValue({
        id: 'order-1',
        orderNumber: 'RO-001',
        status: RentalOrderStatus.DRAFT,
        totalAmount: new Decimal(600000), // Calculation based on logic
      });

      // Mock findOrderById to return the created order
      mockRentalRepository.findOrderById.mockResolvedValue({
        id: 'order-1',
        orderNumber: 'RO-001',
        companyId: 'company-1',
      });

      const result = await service.createOrder(
        input.companyId,
        input as never,
        'user-1'
      );

      expect(mockDocumentNumberService.generate).toHaveBeenCalledWith(
        input.companyId,
        'RNT'
      );
      expect(
        mockRentalRepository.createRentalOrder
      ).toHaveBeenCalled();
      expect(result.orderNumber).toBe('RO-001');
    });

    it('should throw if start date is after end date', async () => {
      const invalidInput = {
        ...getValidInput(),
        rentalStartDate: new Date('2025-01-05'),
        rentalEndDate: new Date('2025-01-01'),
      };

      await expect(
        service.createOrder(
          'company-1',
          invalidInput as never,
          'user-1'
        )
      ).rejects.toThrow(DomainError);
    });

    it('should throw if rental items not found', async () => {
      mockDocumentNumberService.generate.mockResolvedValue('RO-003');
      mockRentalRepository.getCurrentPolicy.mockResolvedValue(null);
      asMock(prisma.rentalItem.findMany).mockResolvedValue([]); // Empty

      await expect(
        service.createOrder(
          'company-1',
          getValidInput() as never,
          'user-1'
        )
      ).rejects.toThrow(/Some rental items not found/);
    });
<<<<<<< HEAD

    it('should snapshot invoice-specific line price and delivery fee', async () => {
      mockDocumentNumberService.generate.mockResolvedValue('RO-004');
      mockRentalRepository.getCurrentPolicy.mockResolvedValue(null);
      asMock(prisma.rentalItem.findMany).mockResolvedValue([
        {
          id: 'item-1',
          dailyRate: new Decimal(30000),
          weeklyRate: new Decimal(180000),
          monthlyRate: new Decimal(650000),
        },
      ]);
      asMock(prisma.rentalBundle.findMany).mockResolvedValue([]);

      mockRentalRepository.createRentalOrder.mockResolvedValue({
        id: 'order-4',
        orderNumber: 'RO-004',
        status: RentalOrderStatus.DRAFT,
        totalAmount: new Decimal(260001),
      });
      mockRentalRepository.findOrderById.mockResolvedValue({
        id: 'order-4',
        orderNumber: 'RO-004',
        companyId: 'company-1',
      });

      await service.createOrder(
        'company-1',
        {
          partnerId: 'customer-1',
          rentalStartDate: new Date('2026-05-01T00:00:00.000Z'),
          rentalEndDate: new Date('2026-05-04T00:00:00.000Z'),
          items: [
            {
              rentalItemId: 'item-1',
              quantity: 2,
              pricePerDay: 40000,
              lineTotal: 240001,
            },
          ],
          deliveryFee: 25000,
          discountAmount: 5000,
        } as never,
        'user-1'
      );

      const createData = mockRentalRepository.createRentalOrder.mock
        .calls[0]?.[0] as Prisma.RentalOrderCreateInput;
      const nestedItems = createData.items as {
        create: Array<{
          unitPrice: Decimal;
          subtotal: Decimal;
          pricingTier: string;
        }>;
      };

      expect(createData.subtotal?.toString()).toBe('240001');
      expect(createData.totalAmount?.toString()).toBe('260001');
      expect(createData.deliveryFee?.toString()).toBe('25000');
      expect(createData.discountAmount?.toString()).toBe('5000');
      expect(nestedItems.create[0]?.unitPrice.toString()).toBe(
        '40000'
      );
      expect(nestedItems.create[0]?.subtotal.toString()).toBe(
        '240001'
      );
      expect(nestedItems.create[0]?.pricingTier).toBe('CUSTOM');
    });
=======
>>>>>>> origin/dev
  });

  describe('cancelOrder', () => {
    it('should cancel a DRAFT order', async () => {
      const order = {
        id: 'order-1',
        status: RentalOrderStatus.DRAFT,
        companyId: 'company-1',
        items: [], // Add minimal required fields
        deposit: null,
      };

      // Use findOrderById instead of findById
      mockRentalRepository.findOrderById.mockResolvedValue(order);

      // Mock transaction
<<<<<<< HEAD
      asMock(prisma.$transaction).mockImplementation((cb: (p: typeof import("@sync-erp/database").prisma) => void) =>
        cb(prisma)
      );
      asMock(prisma.rentalOrderUnitAssignment.findMany).mockResolvedValue([]);
=======
      asMock(prisma.$transaction).mockImplementation(
        (
          cb: (p: typeof import('@sync-erp/database').prisma) => void
        ) => cb(prisma)
      );
      asMock(
        prisma.rentalOrderUnitAssignment.findMany
      ).mockResolvedValue([]);
>>>>>>> origin/dev
      asMock(prisma.rentalOrder.update).mockResolvedValue({
        ...order,
        status: RentalOrderStatus.CANCELLED,
      });

      await service.cancelOrder(
        'company-1',
        'order-1',
        'Changed mind',
        'user-1'
      );

      // Verify transaction call or specific update
      expect(prisma.rentalOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1' },
          data: expect.objectContaining({
            status: RentalOrderStatus.CANCELLED,
          }),
        })
      );
    });

    it('should cancel a CONFIRMED order', async () => {
      const order = {
        id: 'order-2',
        status: RentalOrderStatus.CONFIRMED,
        companyId: 'company-1',
        items: [],
        deposit: null,
      };
      mockRentalRepository.findOrderById.mockResolvedValue(order);

      // Mock transaction
<<<<<<< HEAD
      asMock(prisma.$transaction).mockImplementation((cb: (p: typeof import("@sync-erp/database").prisma) => void) =>
        cb(prisma)
      );
      asMock(prisma.rentalOrderUnitAssignment.findMany).mockResolvedValue([]);
=======
      asMock(prisma.$transaction).mockImplementation(
        (
          cb: (p: typeof import('@sync-erp/database').prisma) => void
        ) => cb(prisma)
      );
      asMock(
        prisma.rentalOrderUnitAssignment.findMany
      ).mockResolvedValue([]);
>>>>>>> origin/dev
      asMock(prisma.rentalOrder.update).mockResolvedValue({
        ...order,
        status: RentalOrderStatus.CANCELLED,
      });

      await service.cancelOrder(
        'company-1',
        'order-2',
        'reason',
        'user-1'
      );

      expect(
        mockRentalWebhookService.notifyOrderCancelled
      ).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'order-2' })
      );
    });

    it('should throw if order is already CANCELLED', async () => {
      const order = {
        id: 'order-3',
        status: RentalOrderStatus.CANCELLED,
        companyId: 'company-1',
      };
      mockRentalRepository.findOrderById.mockResolvedValue(order);

      await expect(
        service.cancelOrder(
          'company-1',
          'order-3',
          'reason',
          'user-1'
        )
      ).rejects.toThrow(DomainError);
    });
  });
<<<<<<< HEAD

  describe('extendOrder', () => {
    it('should record a historical paid extension with exact manual amount', async () => {
      const currentEnd = new Date('2026-03-25T00:00:00.000Z');
      const newEnd = new Date('2026-03-26T00:00:00.000Z');
      const paidAt = new Date('2026-03-26T10:00:00.000Z');
      const businessDate = new Date('2026-03-26T00:00:00.000Z');
      const order = {
        id: 'order-extend-1',
        orderNumber: 'RNT-202603-00016',
        companyId: 'company-1',
        status: RentalOrderStatus.DRAFT,
        rentalEndDate: currentEnd,
        subtotal: new Decimal(638000),
        totalAmount: new Decimal(638000),
        items: [
          {
            id: 'order-item-extend-1',
            rentalItemId: null,
            rentalBundleId: 'bundle-1',
            quantity: 2,
            unitPrice: new Decimal(45000),
            rentalItem: null,
            rentalBundle: {
              dailyRate: new Decimal(45000),
              weeklyRate: new Decimal(270000),
              monthlyRate: new Decimal(1125000),
            },
          },
        ],
        extensions: [],
      };

      asMock(prisma.rentalOrder.findUnique).mockResolvedValue(order);
      asMock(prisma.rentalOrderExtension.create).mockResolvedValue({
        id: 'ext-1',
      });
      asMock(prisma.rentalOrder.update).mockResolvedValue({
        ...order,
        rentalEndDate: newEnd,
        subtotal: new Decimal(877000),
        totalAmount: new Decimal(877000),
      });
      mockRentalRepository.findOrderById.mockResolvedValue({
        ...order,
        rentalEndDate: newEnd,
        subtotal: new Decimal(877000),
        totalAmount: new Decimal(877000),
        extensions: [{ id: 'ext-1' }],
      });

      const result = await service.extendOrder(
        'company-1',
        {
          orderId: 'order-extend-1',
          newEndDate: newEnd,
          additionalAmount: 239000,
          reason: 'sheet row 13 Feris extend',
          isPaid: true,
          paidAt,
          businessDate,
          allowHistorical: true,
        },
        'user-1'
      );

      expect(prisma.rentalOrderExtension.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rentalOrderId: 'order-extend-1',
            previousEndDate: currentEnd,
            newEndDate: newEnd,
            additionalDays: 1,
            reason: 'sheet row 13 Feris extend',
            isPaid: true,
            paidAt,
            createdAt: businessDate,
          }),
        })
      );

      const extensionCreateArg = asMock(
        prisma.rentalOrderExtension.create
      ).mock.calls[0]?.[0] as {
        data: { additionalAmount: Decimal };
      };
      const orderUpdateArg = asMock(
        prisma.rentalOrder.update
      ).mock.calls[0]?.[0] as {
        data: { subtotal: Decimal; totalAmount: Decimal };
      };

      expect(
        extensionCreateArg.data.additionalAmount.toString()
      ).toBe('239000');
      expect(orderUpdateArg.data.subtotal.toString()).toBe(
        '877000'
      );
      expect(orderUpdateArg.data.totalAmount.toString()).toBe(
        '877000'
      );
      expect(mockJournalService.postRentalDeposit).not.toHaveBeenCalled();
      expect(result.id).toBe('order-extend-1');
    });

    it('should reject draft extension unless historical mode is explicit', async () => {
      asMock(prisma.rentalOrder.findUnique).mockResolvedValue({
        id: 'order-extend-2',
        companyId: 'company-1',
        status: RentalOrderStatus.DRAFT,
        rentalEndDate: new Date('2026-03-25T00:00:00.000Z'),
        subtotal: new Decimal(0),
        totalAmount: new Decimal(0),
        items: [],
        extensions: [],
      });

      await expect(
        service.extendOrder(
          'company-1',
          {
            orderId: 'order-extend-2',
            newEndDate: new Date('2026-03-26T00:00:00.000Z'),
            additionalAmount: 80000,
          },
          'user-1'
        )
      ).rejects.toThrow(DomainError);
    });

    it('should calculate extension amount from captured order line prices when no manual amount is provided', async () => {
      const order = {
        id: 'order-extend-3',
        orderNumber: 'RNT-202603-00011',
        companyId: 'company-1',
        status: RentalOrderStatus.ACTIVE,
        rentalEndDate: new Date('2026-03-24T00:00:00.000Z'),
        subtotal: new Decimal(1206000),
        totalAmount: new Decimal(1206000),
        items: [
          {
            id: 'order-item-extend-3',
            rentalItemId: null,
            rentalBundleId: 'bundle-3',
            quantity: 1,
            unitPrice: new Decimal(80000),
            rentalItem: null,
            rentalBundle: {
              dailyRate: new Decimal(55000),
              weeklyRate: new Decimal(330000),
              monthlyRate: new Decimal(1375000),
            },
          },
        ],
        extensions: [],
      };

      asMock(prisma.rentalOrder.findUnique).mockResolvedValue(order);
      asMock(prisma.rentalOrderExtension.create).mockResolvedValue({
        id: 'ext-3',
      });
      asMock(prisma.rentalOrder.update).mockResolvedValue({
        ...order,
        rentalEndDate: new Date('2026-03-25T00:00:00.000Z'),
        subtotal: new Decimal(1286000),
        totalAmount: new Decimal(1286000),
      });
      mockRentalRepository.findOrderById.mockResolvedValue({
        ...order,
        extensions: [{ id: 'ext-3' }],
      });

      await service.extendOrder(
        'company-1',
        {
          orderId: 'order-extend-3',
          newEndDate: new Date('2026-03-25T00:00:00.000Z'),
          reason: 'Yani extend 1 day',
        },
        'user-1'
      );

      const extensionCreateArg = asMock(
        prisma.rentalOrderExtension.create
      ).mock.calls[0]?.[0] as {
        data: { additionalAmount: Decimal };
      };

      expect(
        extensionCreateArg.data.additionalAmount.toString()
      ).toBe('80000');
    });

    it('should record selected item extensions without changing whole order dates by default', async () => {
      const currentEnd = new Date('2026-03-24T00:00:00.000Z');
      const previousItemEnd = new Date('2026-03-25T00:00:00.000Z');
      const newEnd = new Date('2026-03-26T00:00:00.000Z');
      const order = {
        id: 'order-extend-4',
        orderNumber: 'RNT-202603-00014',
        companyId: 'company-1',
        status: RentalOrderStatus.COMPLETED,
        rentalEndDate: currentEnd,
        dueDateTime: new Date('2026-03-24T18:00:00.000Z'),
        subtotal: new Decimal(500000),
        totalAmount: new Decimal(500000),
        items: [
          {
            id: 'order-item-a',
            rentalItemId: 'rental-item-a',
            rentalBundleId: null,
            quantity: 2,
            unitPrice: new Decimal(45000),
            rentalItem: {
              dailyRate: new Decimal(45000),
              weeklyRate: new Decimal(270000),
              monthlyRate: new Decimal(1125000),
            },
            rentalBundle: null,
          },
          {
            id: 'order-item-b',
            rentalItemId: 'rental-item-b',
            rentalBundleId: null,
            quantity: 1,
            unitPrice: new Decimal(80000),
            rentalItem: {
              dailyRate: new Decimal(80000),
              weeklyRate: new Decimal(480000),
              monthlyRate: new Decimal(2000000),
            },
            rentalBundle: null,
          },
        ],
        extensions: [
          {
            id: 'ext-prior',
            items: [
              {
                rentalOrderItemId: 'order-item-a',
                newEndDate: previousItemEnd,
              },
            ],
          },
        ],
      };

      asMock(prisma.rentalOrder.findUnique).mockResolvedValue(order);
      asMock(prisma.rentalOrderExtension.create).mockResolvedValue({
        id: 'ext-4',
      });
      asMock(prisma.rentalOrder.update).mockResolvedValue({
        ...order,
        subtotal: new Decimal(545000),
        totalAmount: new Decimal(568000),
      });
      mockRentalRepository.findOrderById.mockResolvedValue({
        ...order,
        subtotal: new Decimal(545000),
        totalAmount: new Decimal(568000),
        extensions: [{ id: 'ext-4', items: [{ id: 'ext-item-1' }] }],
      });

      await service.extendOrder(
        'company-1',
        {
          orderId: 'order-extend-4',
          newEndDate: newEnd,
          items: [
            {
              rentalOrderItemId: 'order-item-a',
              quantity: 1,
              additionalAmount: 45000,
              notes: 'Only one mattress extended',
            },
          ],
          deliveryFee: 23000,
          deliveryFeeLabel: 'Partial extension delivery fee',
          allowHistorical: true,
          isPaid: true,
        },
        'user-1'
      );

      const extensionCreateArg = asMock(
        prisma.rentalOrderExtension.create
      ).mock.calls[0]?.[0] as {
        data: {
          previousEndDate: Date;
          additionalAmount: Decimal;
          deliveryFee: Decimal;
          deliveryFeeLabel?: string;
          items?: {
            create: Array<{
              rentalOrderItem: { connect: { id: string } };
              quantity: number;
              additionalAmount: Decimal;
              previousEndDate: Date;
              newEndDate: Date;
            }>;
          };
        };
      };
      const orderUpdateArg = asMock(
        prisma.rentalOrder.update
      ).mock.calls[0]?.[0] as {
        data: { rentalEndDate: Date; subtotal: Decimal; totalAmount: Decimal };
      };

      expect(
        extensionCreateArg.data.additionalAmount.toString()
      ).toBe('68000');
      expect(extensionCreateArg.data.deliveryFee.toString()).toBe(
        '23000'
      );
      expect(extensionCreateArg.data.deliveryFeeLabel).toBe(
        'Partial extension delivery fee'
      );
      expect(extensionCreateArg.data.previousEndDate).toEqual(previousItemEnd);
      expect(extensionCreateArg.data.items?.create).toHaveLength(1);
      expect(
        extensionCreateArg.data.items?.create[0]?.rentalOrderItem.connect.id
      ).toBe('order-item-a');
      expect(extensionCreateArg.data.items?.create[0]?.quantity).toBe(1);
      expect(
        extensionCreateArg.data.items?.create[0]?.additionalAmount.toString()
      ).toBe('45000');
      expect(
        extensionCreateArg.data.items?.create[0]?.previousEndDate
      ).toEqual(previousItemEnd);
      expect(orderUpdateArg.data.rentalEndDate).toEqual(currentEnd);
      expect(orderUpdateArg.data.subtotal.toString()).toBe('545000');
      expect(orderUpdateArg.data.totalAmount.toString()).toBe('568000');
    });
  });
=======
>>>>>>> origin/dev
});
