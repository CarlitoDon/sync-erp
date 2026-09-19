import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RentalReturnService } from '@modules/rental/rental-return.service';
import {
  mockRentalRepository,
  resetRepositoryMocks,
} from '../mocks/repositories.mock';
import {
  mockJournalService,
  resetServiceMocks,
} from '../mocks/services.mock';
import {
  RentalOrderStatus,
  ReturnStatus,
  UnitStatus,
  InvoiceType,
  InvoiceStatus,
  prisma,
} from '@sync-erp/database';
import { DomainError, asMock } from '@sync-erp/shared';
import { Decimal } from 'decimal.js';

vi.mock('@modules/billing/billing-limits.service', () => ({
  isBillingFeatureEnabled: vi.fn().mockResolvedValue(true),
}));

vi.mock('@modules/common/audit/audit-log.service', () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}));

describe('RentalReturnService', () => {
  let service: RentalReturnService;
  const COMPANY_ID = 'company-test-1';
  const USER_ID = 'user-test-1';

  beforeEach(() => {
    resetRepositoryMocks();
    resetServiceMocks();
    vi.clearAllMocks();

    service = new RentalReturnService(
      mockRentalRepository as unknown as import('../../../src/modules/rental/rental.repository').RentalRepository,
      mockJournalService as unknown as import('../../../src/modules/accounting/services/journal.service').JournalService
    );

    // Setup transaction mock
    asMock(prisma.$transaction).mockImplementation(
      (cb: (p: typeof import('@sync-erp/database').prisma) => Promise<unknown>) =>
        cb(prisma)
    );

    // Default safe mocks for Prisma
    asMock(prisma.rentalItemUnit.findMany).mockResolvedValue([]);
    asMock(prisma.rentalDamagePolicy.findMany).mockResolvedValue([]);
    asMock(prisma.itemConditionLog.create).mockResolvedValue({});
    asMock(prisma.rentalOrderUnitAssignment.findMany).mockResolvedValue([]);
    asMock(prisma.rentalItemUnit.updateMany).mockResolvedValue({ count: 1 });
    asMock(prisma.rentalOrder.update).mockResolvedValue({});
    asMock(prisma.rentalOrder.updateMany).mockResolvedValue({ count: 1 });
    asMock(prisma.rentalReturn.create).mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'return-test-1',
        ...data,
      })
    );
    asMock(prisma.rentalReturn.update).mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'return-test-1',
        ...data,
      })
    );
    asMock(prisma.rentalReturn.updateMany).mockResolvedValue({ count: 1 });
    asMock(prisma.rentalReturn.findUniqueOrThrow).mockImplementation(
      async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        settlementStatus: ReturnStatus.SETTLED,
        settledAt: new Date(),
        settledBy: USER_ID,
      })
    );
    asMock(prisma.invoice.findFirst).mockResolvedValue(null);
    asMock(prisma.journalEntry.findMany).mockResolvedValue([]);
  });

  const getActiveOrder = (overrides: Record<string, unknown> = {}) => ({
    id: 'order-ret-1',
    orderNumber: 'RNT-202603-00001',
    companyId: COMPANY_ID,
    status: RentalOrderStatus.ACTIVE,
    rentalStartDate: new Date('2026-03-20T00:00:00.000Z'),
    rentalEndDate: new Date('2026-03-22T00:00:00.000Z'),
    dueDateTime: new Date('2026-03-22T18:00:00.000Z'),
    subtotal: new Decimal(200000),
    totalAmount: new Decimal(200000),
    depositAmount: new Decimal(0),
    policySnapshot: {
      gracePeriodHours: 2,
      lateFeeDailyRate: 50000,
      cleaningFee: 0,
      pickupGracePeriodHours: 2,
    },
    partner: { name: 'Customer Test' },
    items: [],
    unitAssignments: [
      { rentalItemUnitId: 'unit-clean-1' },
      { rentalItemUnitId: 'unit-damaged-2' },
    ],
    ...overrides,
  });

  describe('processReturn - Unit Routing and Invariants (N1)', () => {
    it('should keep units RENTED when return is unsettled (isSettled === false)', async () => {
      const order = getActiveOrder();
      mockRentalRepository.findOrderById.mockResolvedValue(order);
      asMock(prisma.rentalReturn.findUnique).mockResolvedValue(null);

      asMock(prisma.rentalItemUnit.findMany).mockResolvedValue([
        { id: 'unit-damaged-2', rentalItemId: 'item-1', rentalItem: null },
      ]);
      asMock(prisma.rentalDamagePolicy.findMany).mockResolvedValue([]);

      const result = await service.processReturn(
        COMPANY_ID,
        {
          orderId: 'order-ret-1',
          actualReturnDate: new Date('2026-03-22T12:00:00.000Z'), // On time
          units: [
            {
              unitId: 'unit-damaged-2',
              damageSeverity: 'MAJOR', // 150,000 damage charge
              condition: 'NEEDS_REPAIR',
              afterPhotos: [],
            },
          ],
          // No damagePayment provided -> unsettled!
        },
        USER_ID
      );

      // Return record created with DRAFT settlement status
      expect(result.settlementStatus).toBe(ReturnStatus.DRAFT);
      expect(result.settledAt).toBeNull();

      // Units MUST NOT be updated to AVAILABLE or MAINTENANCE (they stay RENTED per N1)
      expect(prisma.rentalItemUnit.updateMany).not.toHaveBeenCalled();

      // Order MUST NOT be completed
      expect(prisma.rentalOrder.update).not.toHaveBeenCalled();
    });

    it('should transition units to AVAILABLE and MAINTENANCE when return is settled', async () => {
      const order = getActiveOrder();
      mockRentalRepository.findOrderById.mockResolvedValue(order);
      asMock(prisma.rentalReturn.findUnique).mockResolvedValue(null);

      asMock(prisma.rentalItemUnit.findMany).mockResolvedValue([
        { id: 'unit-clean-1', rentalItemId: 'item-1', rentalItem: null },
        { id: 'unit-damaged-2', rentalItemId: 'item-1', rentalItem: null },
      ]);
      asMock(prisma.rentalDamagePolicy.findMany).mockResolvedValue([]);

      const result = await service.processReturn(
        COMPANY_ID,
        {
          orderId: 'order-ret-1',
          actualReturnDate: new Date('2026-03-22T12:00:00.000Z'),
          units: [
            {
              unitId: 'unit-clean-1',
              condition: 'GOOD',
              afterPhotos: [],
            },
            {
              unitId: 'unit-damaged-2',
              damageSeverity: 'MAJOR', // 150,000 damage
              condition: 'NEEDS_REPAIR',
              afterPhotos: [],
            },
          ],
          damagePayment: {
            amount: 150000,
            paymentMethod: 'CASH',
          },
        },
        USER_ID
      );

      expect(result.settlementStatus).toBe(ReturnStatus.SETTLED);
      expect(result.settledAt).toBeDefined();

      // Clean unit routed to AVAILABLE
      expect(prisma.rentalItemUnit.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['unit-clean-1'] } },
          data: { status: UnitStatus.AVAILABLE },
        })
      );

      // Damaged unit routed to MAINTENANCE (never CLEANING)
      expect(prisma.rentalItemUnit.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['unit-damaged-2'] } },
          data: { status: UnitStatus.MAINTENANCE },
        })
      );

      // Order completed
      expect(prisma.rentalOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-ret-1' },
          data: expect.objectContaining({
            status: RentalOrderStatus.COMPLETED,
          }),
        })
      );
    });
  });

  describe('createInvoiceFromReturn - Deduct On-the-spot Paid Amount (N2)', () => {
    it('should deduct damagePaid from notes and prevent double billing', async () => {
      const returnRecord = {
        id: 'return-inv-1',
        companyId: COMPANY_ID,
        rentalOrderId: 'order-ret-1',
        totalCharges: new Decimal(150000),
        additionalChargesDue: new Decimal(150000),
        notes: JSON.stringify({ damagePaid: 50000 }),
        rentalOrder: {
          id: 'order-ret-1',
          orderNumber: 'RNT-202603-00001',
          partnerId: 'partner-1',
        },
      };

      asMock(prisma.rentalReturn.findUnique).mockResolvedValue(returnRecord);
      asMock(prisma.invoice.create).mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'inv-test-1',
          ...data,
        })
      );

      await service.createInvoiceFromReturn(COMPANY_ID, 'return-inv-1');

      // 150,000 - 50,000 = 100,000 invoice
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: COMPANY_ID,
            partnerId: 'partner-1',
            type: InvoiceType.RENTAL,
            status: InvoiceStatus.DRAFT,
            amount: new Decimal(100000),
            balance: new Decimal(100000),
          }),
        })
      );
    });

    it('should fallback to journalEntry records when notes is missing or not JSON and deduct paid amounts', async () => {
      const returnRecord = {
        id: 'return-inv-fallback',
        companyId: COMPANY_ID,
        rentalOrderId: 'order-ret-1',
        totalCharges: new Decimal(200000),
        additionalChargesDue: new Decimal(200000),
        notes: 'Customer returned with broken wheel', // Not JSON
        rentalOrder: {
          id: 'order-ret-1',
          orderNumber: 'RNT-202603-00001',
          partnerId: 'partner-1',
        },
      };

      asMock(prisma.rentalReturn.findUnique).mockResolvedValue(returnRecord);
      asMock(prisma.journalEntry.findMany).mockResolvedValue([
        {
          lines: [
            { debit: new Decimal(150000), credit: new Decimal(0) },
            { debit: new Decimal(0), credit: new Decimal(150000) },
          ],
        },
        {
          lines: [
            { debit: new Decimal(25000), credit: new Decimal(0) },
            { debit: new Decimal(0), credit: new Decimal(25000) },
          ],
        },
      ]);
      asMock(prisma.invoice.create).mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'inv-test-fallback',
          ...data,
        })
      );

      await service.createInvoiceFromReturn(COMPANY_ID, 'return-inv-fallback');

      // 200,000 - (150,000 + 25,000) = 25,000 invoice
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: COMPANY_ID,
            partnerId: 'partner-1',
            type: InvoiceType.RENTAL,
            status: InvoiceStatus.DRAFT,
            amount: new Decimal(25000),
            balance: new Decimal(25000),
          }),
        })
      );
    });

    it('should reject creating invoice if an active invoice already exists for this return', async () => {
      const returnRecord = {
        id: 'return-inv-dup',
        companyId: COMPANY_ID,
        rentalOrderId: 'order-ret-1',
        totalCharges: new Decimal(150000),
        additionalChargesDue: new Decimal(150000),
        notes: null,
        rentalOrder: {
          id: 'order-ret-1',
          orderNumber: 'RNT-202603-00001',
          partnerId: 'partner-1',
        },
      };

      asMock(prisma.rentalReturn.findUnique).mockResolvedValue(returnRecord);
      asMock(prisma.invoice.findFirst).mockResolvedValue({
        id: 'existing-inv-1',
        type: InvoiceType.RENTAL,
        status: InvoiceStatus.DRAFT,
      });

      await expect(
        service.createInvoiceFromReturn(COMPANY_ID, 'return-inv-dup')
      ).rejects.toThrow(DomainError);
    });

    it('should throw 400 when charges were fully paid on the spot', async () => {
      const returnRecord = {
        id: 'return-inv-2',
        companyId: COMPANY_ID,
        rentalOrderId: 'order-ret-1',
        totalCharges: new Decimal(150000),
        additionalChargesDue: new Decimal(150000),
        notes: JSON.stringify({ damagePaid: 150000 }),
        rentalOrder: {
          id: 'order-ret-1',
          orderNumber: 'RNT-202603-00001',
          partnerId: 'partner-1',
        },
      };

      asMock(prisma.rentalReturn.findUnique).mockResolvedValue(returnRecord);

      await expect(
        service.createInvoiceFromReturn(COMPANY_ID, 'return-inv-2')
      ).rejects.toThrow(DomainError);
    });
  });

  describe('processReturn - On-the-spot Split Damage & Late Fee Journal (N3)', () => {
    it('should split damagePayment between postRentalDamageFee and postRentalLateFee', async () => {
      // Order due on 2026-03-22T18:00:00Z, returned on 2026-03-23T18:00:00Z (24h overdue -> 1 day late fee)
      const order = getActiveOrder();
      mockRentalRepository.findOrderById.mockResolvedValue(order);
      asMock(prisma.rentalReturn.findUnique).mockResolvedValue(null);

      asMock(prisma.rentalItemUnit.findMany).mockResolvedValue([
        { id: 'unit-damaged-2', rentalItemId: 'item-1', rentalItem: null },
      ]);
      asMock(prisma.rentalDamagePolicy.findMany).mockResolvedValue([]);

      // Damage: 150,000 (MAJOR). Late fee: 50,000 (1 day late). Total charges: 200,000.
      await service.processReturn(
        COMPANY_ID,
        {
          orderId: 'order-ret-1',
          actualReturnDate: new Date('2026-03-23T20:00:00.000Z'),
          units: [
            {
              unitId: 'unit-damaged-2',
              damageSeverity: 'MAJOR',
              condition: 'NEEDS_REPAIR',
              afterPhotos: [],
            },
          ],
          damagePayment: {
            amount: 200000,
            paymentMethod: 'CASH',
            paymentAccountId: 'acc-cash-1',
          },
        },
        USER_ID
      );

      // Verify postRentalDamageFee called for 150,000
      expect(mockJournalService.postRentalDamageFee).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: COMPANY_ID,
          orderId: 'order-ret-1',
          damageFeeAmount: 150000,
          paymentMethod: 'CASH',
        })
      );

      // Verify postRentalLateFee called for remaining 50,000 (N3)
      expect(mockJournalService.postRentalLateFee).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: COMPANY_ID,
          orderId: 'order-ret-1',
          lateFeeAmount: 50000,
          paymentMethod: 'CASH',
        })
      );
    });

    it('should map dirty unit condition to FAIR in itemConditionLog when condition is omitted', async () => {
      const order = getActiveOrder();
      mockRentalRepository.findOrderById.mockResolvedValue(order);
      asMock(prisma.rentalReturn.findUnique).mockResolvedValue(null);

      asMock(prisma.rentalItemUnit.findMany).mockResolvedValue([
        { id: 'unit-dirty-3', rentalItemId: 'item-1', rentalItem: null },
      ]);

      await service.processReturn(
        COMPANY_ID,
        {
          orderId: 'order-ret-1',
          actualReturnDate: new Date('2026-03-22T12:00:00.000Z'),
          units: [
            {
              unitId: 'unit-dirty-3',
              condition: 'GOOD',
              conditionStatus: 'DIRTY',
              afterPhotos: [],
            },
          ],
        },
        USER_ID
      );

      expect(prisma.itemConditionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rentalItemUnitId: 'unit-dirty-3',
            condition: 'FAIR',
          }),
        })
      );
    });
  });

  describe('finalizeReturn - Spec 045 Alignment (H6)', () => {
    it('should route units to AVAILABLE/MAINTENANCE, settle return and order, and NOT debit 2400 or post cash journals', async () => {
      const returnRecord = {
        id: 'return-fin-1',
        companyId: COMPANY_ID,
        rentalOrderId: 'order-ret-1',
        settlementStatus: ReturnStatus.DRAFT,
        rentalOrder: {
          id: 'order-ret-1',
          orderNumber: 'RNT-202603-00001',
          partnerId: 'partner-1',
          partner: { name: 'Customer Test' },
          unitAssignments: [
            { rentalItemUnitId: 'unit-clean-1' },
            { rentalItemUnitId: 'unit-damaged-2' },
          ],
        },
      };

      asMock(prisma.rentalReturn.findUnique).mockResolvedValue(returnRecord);
      asMock(prisma.itemConditionLog.findMany).mockResolvedValue([
        {
          rentalItemUnitId: 'unit-clean-1',
          condition: 'GOOD',
          damageSeverity: null,
        },
        {
          rentalItemUnitId: 'unit-damaged-2',
          condition: 'NEEDS_REPAIR',
          damageSeverity: 'MAJOR',
        },
      ]);

      const result = await service.finalizeReturn(
        COMPANY_ID,
        'return-fin-1',
        USER_ID
      );

      expect(result.settlementStatus).toBe(ReturnStatus.SETTLED);

      // Clean unit -> AVAILABLE
      expect(prisma.rentalItemUnit.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['unit-clean-1'] } },
          data: { status: UnitStatus.AVAILABLE },
        })
      );

      // Damaged unit -> MAINTENANCE (never CLEANING per H6)
      expect(prisma.rentalItemUnit.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['unit-damaged-2'] } },
          data: { status: UnitStatus.MAINTENANCE },
        })
      );

      // Order completed atomically
      expect(prisma.rentalOrder.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-ret-1', status: RentalOrderStatus.ACTIVE },
          data: expect.objectContaining({
            status: RentalOrderStatus.COMPLETED,
          }),
        })
      );

      // No pseudo-deposit journal (postRentalReturn) or cash receipt journal should be called (H6)
      expect(mockJournalService.postRentalReturn).not.toHaveBeenCalled();
      expect(mockJournalService.postRentalDamageFee).not.toHaveBeenCalled();
      expect(mockJournalService.postRentalDownPayment).not.toHaveBeenCalled();
    });

    it('should throw 409 when concurrent request already finalized the return', async () => {
      const returnRecord = {
        id: 'return-fin-race',
        companyId: COMPANY_ID,
        rentalOrderId: 'order-ret-1',
        settlementStatus: ReturnStatus.DRAFT,
        rentalOrder: {
          id: 'order-ret-1',
          orderNumber: 'RNT-202603-00001',
          partnerId: 'partner-1',
          partner: { name: 'Customer Test' },
          unitAssignments: [],
        },
      };

      asMock(prisma.rentalReturn.findUnique).mockResolvedValue(returnRecord);
      asMock(prisma.itemConditionLog.findMany).mockResolvedValue([]);
      asMock(prisma.rentalReturn.updateMany).mockResolvedValue({ count: 0 });

      await expect(
        service.finalizeReturn(COMPANY_ID, 'return-fin-race', USER_ID)
      ).rejects.toThrow(DomainError);
    });

    it('should reject finalizing an already settled return', async () => {
      const returnRecord = {
        id: 'return-fin-settled',
        companyId: COMPANY_ID,
        rentalOrderId: 'order-ret-1',
        settlementStatus: ReturnStatus.SETTLED,
      };

      asMock(prisma.rentalReturn.findUnique).mockResolvedValue(returnRecord);

      await expect(
        service.finalizeReturn(COMPANY_ID, 'return-fin-settled', USER_ID)
      ).rejects.toThrow(DomainError);
    });
  });
});
