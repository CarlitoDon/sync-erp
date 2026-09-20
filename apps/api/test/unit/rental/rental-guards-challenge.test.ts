import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RentalOrderFulfillmentService } from '../../../src/modules/rental/rental-order-fulfillment.service';
import { RentalOrderLifecycleService } from '../../../src/modules/rental/rental-order-lifecycle.service';
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
  prisma,
} from '@sync-erp/database';
import { DomainError, DomainErrorCodes, asMock } from '@sync-erp/shared';
import { Decimal } from 'decimal.js';

describe('Milestone M1 Empirical Challenge: Centralized Guards & Accounting', () => {
  const COMPANY_ID = 'test-co-empirical-m1';
  const ACTOR_ID = 'test-user-empirical';

  let fulfillmentService: RentalOrderFulfillmentService;
  let lifecycleService: RentalOrderLifecycleService;

  beforeEach(() => {
    resetRepositoryMocks();
    resetServiceMocks();
    vi.clearAllMocks();

    fulfillmentService = new RentalOrderFulfillmentService(
      mockRentalRepository as unknown as import('../../../src/modules/rental/rental.repository').RentalRepository,
      mockJournalService as unknown as import('../../../src/modules/accounting/services/journal.service').JournalService
    );

    lifecycleService = new RentalOrderLifecycleService(
      mockRentalRepository as unknown as import('../../../src/modules/rental/rental.repository').RentalRepository,
      mockDocumentNumberService as unknown as import('../../../src/modules/common/services/document-number.service').DocumentNumberService,
      mockJournalService as unknown as import('../../../src/modules/accounting/services/journal.service').JournalService,
      mockRentalWebhookService as unknown as import('../../../src/modules/rental/rental-webhook.service').RentalWebhookService
    );

    asMock(prisma.companySubscription.findUnique).mockResolvedValue({
      planKey: 'starter',
    });
    mockRentalRepository.getCurrentPolicy.mockResolvedValue({
      defaultDepositPolicyType: 'PER_UNIT',
    } as never);
    asMock(prisma.$transaction).mockImplementation(
      (cb: (p: typeof import('@sync-erp/database').prisma) => unknown) => cb(prisma)
    );
    asMock(prisma.rentalOrder.updateMany).mockResolvedValue({ count: 1 });
    asMock(prisma.rentalOrderUnitAssignment.findMany).mockResolvedValue([]);
    asMock(prisma.auditLog.create).mockResolvedValue({});
  });

  describe('1. RentalOrderFulfillmentService.confirmOrder guards', () => {
    const input = {
      orderId: 'order-confirm-test',
      unitAssignments: [],
    };

    it.each([
      RentalOrderStatus.CONFIRMED,
      RentalOrderStatus.ACTIVE,
      RentalOrderStatus.COMPLETED,
      RentalOrderStatus.CANCELLED,
    ])('should reject confirmOrder when status is %s with DomainError OPERATION_NOT_ALLOWED', async (status) => {
      mockRentalRepository.findOrderById.mockResolvedValue({
        id: 'order-confirm-test',
        companyId: COMPANY_ID,
        status,
        orderNumber: 'RO-CONF-001',
        totalAmount: new Decimal(100000),
        depositAmount: new Decimal(0),
        items: [],
      } as never);

      try {
        await fulfillmentService.confirmOrder(COMPANY_ID, input, ACTOR_ID);
        expect.fail(`Should have thrown for status ${status}`);
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(DomainError);
        const domainErr = err as DomainError;
        expect(domainErr.statusCode).toBe(400);
        expect(domainErr.code).toBe(DomainErrorCodes.OPERATION_NOT_ALLOWED);
        expect(domainErr.message).toBe(`Only DRAFT orders can be confirmed. Current status: ${status}`);
      }
    });
  });

  describe('2. RentalOrderFulfillmentService.manualConfirmOrder guards', () => {
    const manualInput = {
      orderId: 'order-manual-confirm-test',
      paymentMethodId: 'pm-1',
      paymentAmount: 50000,
      paymentReference: 'REF-M1-CHALLENGE',
      notes: 'Testing manual confirm guard',
      skipStockCheck: true,
      accountingTreatment: 'POST_CASH_JOURNAL' as const,
    };

    it.each([
      RentalOrderStatus.CONFIRMED,
      RentalOrderStatus.ACTIVE,
      RentalOrderStatus.COMPLETED,
      RentalOrderStatus.CANCELLED,
    ])('should reject manualConfirmOrder when status is %s with DomainError OPERATION_NOT_ALLOWED', async (status) => {
      mockRentalRepository.findOrderById.mockResolvedValue({
        id: 'order-manual-confirm-test',
        companyId: COMPANY_ID,
        status,
        orderNumber: 'RO-MAN-001',
        totalAmount: new Decimal(100000),
        depositAmount: new Decimal(0),
        items: [],
      } as never);

      try {
        await fulfillmentService.manualConfirmOrder(COMPANY_ID, manualInput, ACTOR_ID);
        expect.fail(`Should have thrown for status ${status}`);
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(DomainError);
        const domainErr = err as DomainError;
        expect(domainErr.statusCode).toBe(400);
        expect(domainErr.code).toBe(DomainErrorCodes.OPERATION_NOT_ALLOWED);
        expect(domainErr.message).toBe(`Only DRAFT orders can be confirmed. Current status: ${status}`);
      }
    });
  });

  describe('3. RentalOrderLifecycleService.cancelOrder guards', () => {
    it.each([
      RentalOrderStatus.ACTIVE,
      RentalOrderStatus.COMPLETED,
      RentalOrderStatus.CANCELLED,
    ])('should reject cancelOrder when status is %s with DomainError OPERATION_NOT_ALLOWED', async (status) => {
      mockRentalRepository.findOrderById.mockResolvedValue({
        id: 'order-cancel-test',
        companyId: COMPANY_ID,
        status,
        orderNumber: 'RO-CANCEL-001',
        items: [],
        deposit: null,
      } as never);

      try {
        await lifecycleService.cancelOrder(COMPANY_ID, 'order-cancel-test', 'Challenge test reason', ACTOR_ID);
        expect.fail(`Should have thrown for status ${status}`);
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(DomainError);
        const domainErr = err as DomainError;
        expect(domainErr.statusCode).toBe(400);
        expect(domainErr.code).toBe(DomainErrorCodes.OPERATION_NOT_ALLOWED);
        expect(domainErr.message).toBe(`Cannot cancel order in status ${status}`);
      }
    });

    it('should allow cancelOrder when status is DRAFT or CONFIRMED', async () => {
      for (const validStatus of [RentalOrderStatus.DRAFT, RentalOrderStatus.CONFIRMED]) {
        mockRentalRepository.findOrderById.mockResolvedValue({
          id: `order-cancel-${validStatus}`,
          companyId: COMPANY_ID,
          status: validStatus,
          orderNumber: `RO-CANCEL-${validStatus}`,
          items: [],
          deposit: null,
        } as never);

        asMock(prisma.rentalOrder.findUniqueOrThrow).mockResolvedValue({
          id: `order-cancel-${validStatus}`,
          companyId: COMPANY_ID,
          status: RentalOrderStatus.CANCELLED,
          orderNumber: `RO-CANCEL-${validStatus}`,
          items: [],
          extensions: [],
        });

        const result = await lifecycleService.cancelOrder(
          COMPANY_ID,
          `order-cancel-${validStatus}`,
          'Valid cancellation',
          ACTOR_ID
        );

        expect(result.status).toBe(RentalOrderStatus.CANCELLED);
      }
    });
  });

  describe('4. Accounting Journal Regression Checks', () => {
    it('should correctly trigger postRentalDownPayment when accountingTreatment is POST_CASH_JOURNAL', async () => {
      const draftOrder = {
        id: 'order-acct-test',
        companyId: COMPANY_ID,
        status: RentalOrderStatus.DRAFT,
        orderNumber: 'RO-ACCT-001',
        totalAmount: new Decimal(200000),
        depositAmount: new Decimal(0),
        items: [],
      };

      mockRentalRepository.findOrderById.mockResolvedValue(draftOrder as never);
      asMock(prisma.companyPaymentMethod.findFirst).mockResolvedValue({
        id: 'pm-bank-1',
        code: 'BCA_TRANSFER',
        name: 'BCA Transfer',
      });
      asMock(prisma.rentalOrderItem.findMany).mockResolvedValue([]);
      asMock(prisma.rentalDeposit.create).mockResolvedValue({
        id: 'dep-1',
        amount: new Decimal(75000),
      });
      asMock(prisma.rentalOrderUnitAssignment.createMany).mockResolvedValue({ count: 0 });
      asMock(prisma.rentalOrder.update).mockResolvedValue({
        ...draftOrder,
        status: RentalOrderStatus.CONFIRMED,
        depositAmount: new Decimal(75000),
      });

      await fulfillmentService.manualConfirmOrder(
        COMPANY_ID,
        {
          orderId: 'order-acct-test',
          paymentMethodId: 'pm-bank-1',
          paymentAmount: 75000,
          paymentReference: 'TRX-75K',
          notes: 'Testing DP journal entry',
          skipStockCheck: true,
          accountingTreatment: 'POST_CASH_JOURNAL',
        },
        ACTOR_ID
      );

      expect(mockJournalService.postRentalDownPayment).toHaveBeenCalledTimes(1);
      expect(mockJournalService.postRentalDownPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: COMPANY_ID,
          orderId: 'order-acct-test',
          orderNumber: 'RO-ACCT-001',
          downPaymentAmount: 75000,
          paymentMethod: 'BCA_TRANSFER',
        })
      );
    });

    it('should NOT trigger postRentalDownPayment when accountingTreatment is OPENING_BALANCE_NO_POSTING', async () => {
      const draftOrder = {
        id: 'order-acct-nobal',
        companyId: COMPANY_ID,
        status: RentalOrderStatus.DRAFT,
        orderNumber: 'RO-ACCT-002',
        totalAmount: new Decimal(200000),
        depositAmount: new Decimal(0),
        items: [],
      };

      mockRentalRepository.findOrderById.mockResolvedValue(draftOrder as never);
      asMock(prisma.companyPaymentMethod.findFirst).mockResolvedValue({
        id: 'pm-bank-1',
        code: 'BCA_TRANSFER',
        name: 'BCA Transfer',
      });
      asMock(prisma.rentalOrderItem.findMany).mockResolvedValue([]);
      asMock(prisma.rentalDeposit.create).mockResolvedValue({
        id: 'dep-2',
        amount: new Decimal(75000),
      });
      asMock(prisma.rentalOrderUnitAssignment.createMany).mockResolvedValue({ count: 0 });
      asMock(prisma.rentalOrder.update).mockResolvedValue({
        ...draftOrder,
        status: RentalOrderStatus.CONFIRMED,
        depositAmount: new Decimal(75000),
      });

      await fulfillmentService.manualConfirmOrder(
        COMPANY_ID,
        {
          orderId: 'order-acct-nobal',
          paymentMethodId: 'pm-bank-1',
          paymentAmount: 75000,
          paymentReference: 'TRX-75K',
          notes: 'Testing opening balance no posting',
          skipStockCheck: true,
          accountingTreatment: 'OPENING_BALANCE_NO_POSTING',
        },
        ACTOR_ID
      );

      expect(mockJournalService.postRentalDownPayment).not.toHaveBeenCalled();
    });
  });
});
