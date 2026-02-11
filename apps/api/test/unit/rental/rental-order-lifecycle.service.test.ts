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
  prisma,
} from '@sync-erp/database';
import { DomainError } from '@sync-erp/shared';
import { Decimal } from 'decimal.js';

describe('RentalOrderLifecycleService', () => {
  let service: RentalOrderLifecycleService;

  beforeEach(() => {
    resetRepositoryMocks();
    resetServiceMocks();
    vi.clearAllMocks();

    service = new RentalOrderLifecycleService(
      mockRentalRepository as any,
      mockDocumentNumberService as any,
      mockJournalService as any,
      mockRentalWebhookService as any
    );

    // Setup default safe mocks for Prisma
    (prisma.rentalItem.findMany as any).mockResolvedValue([]);
    (prisma.rentalBundle.findMany as any).mockResolvedValue([]);
    (
      prisma.rentalOrderUnitAssignment.findMany as any
    ).mockResolvedValue([]);
    (prisma.auditLog.create as any).mockResolvedValue({});
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
      (prisma.rentalItem.findMany as any).mockResolvedValue([
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
      (prisma.rentalBundle.findMany as any).mockResolvedValue([]);

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
        input as any,
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
          invalidInput as any,
          'user-1'
        )
      ).rejects.toThrow(DomainError);
    });

    it('should throw if rental items not found', async () => {
      mockDocumentNumberService.generate.mockResolvedValue('RO-003');
      mockRentalRepository.getCurrentPolicy.mockResolvedValue(null);
      (prisma.rentalItem.findMany as any).mockResolvedValue([]); // Empty

      await expect(
        service.createOrder(
          'company-1',
          getValidInput() as any,
          'user-1'
        )
      ).rejects.toThrow(/Some rental items not found/);
    });
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
      (prisma.$transaction as any).mockImplementation((cb: any) =>
        cb(prisma)
      );
      (
        prisma.rentalOrderUnitAssignment.findMany as any
      ).mockResolvedValue([]);
      (prisma.rentalOrder.update as any).mockResolvedValue({
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
      (prisma.$transaction as any).mockImplementation((cb: any) =>
        cb(prisma)
      );
      (
        prisma.rentalOrderUnitAssignment.findMany as any
      ).mockResolvedValue([]);
      (prisma.rentalOrder.update as any).mockResolvedValue({
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
});
