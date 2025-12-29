/**
 * Upfront Payment Service
 *
 * Feature 036: Handle upfront payments for Purchase Orders.
 * Accounting: Dr 1600 (Advances to Supplier), Cr Cash/Bank
 */

import {
  Payment,
  PaymentStatus,
  PaymentTerms,
} from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';
import { PurchaseOrderPolicy } from './purchase-order.policy';
import { UpfrontPaymentRepository } from './upfront-payment.repository';
import { JournalService } from '../accounting/services/journal.service';

interface RegisterUpfrontPaymentInput {
  orderId: string;
  amount: number;
  method: string;
  accountId?: string;
  reference?: string;
  businessDate?: Date;
}

export class UpfrontPaymentService {
  constructor(
    private readonly repository: UpfrontPaymentRepository = new UpfrontPaymentRepository(),
    private readonly journalService: JournalService = new JournalService()
  ) {}

  /**
   * T031: Register an upfront payment for a PO.
   * Creates Payment record linked to Order (not Invoice).
   * Posts journal: Dr 1600, Cr Cash/Bank.
   * Updates Order.paidAmount and paymentStatus.
   */
  async registerPayment(
    companyId: string,
    input: RegisterUpfrontPaymentInput,
    _userId: string
  ): Promise<Payment> {
    return this.repository.withTransaction(
      async (tx) => {
        // 1. Lock and fetch order via repository
        const order = await this.repository.findOrderForUpdate(
          input.orderId,
          companyId,
          tx
        );

        if (!order) {
          throw new DomainError(
            'Purchase order not found',
            404,
            DomainErrorCodes.ORDER_NOT_FOUND
          );
        }

        // 2. Policy validations (T026, T027)
        PurchaseOrderPolicy.ensureCanRegisterPayment({
          status: order.status,
          paymentTerms: order.paymentTerms,
          paymentStatus: order.paymentStatus,
        });

        PurchaseOrderPolicy.ensurePaymentWithinLimit(
          {
            totalAmount: order.totalAmount,
            paidAmount: order.paidAmount,
          },
          input.amount
        );

        // 3. Create Payment record via repository (T029)
        const payment = await this.repository.createPayment(
          {
            companyId,
            orderId: order.id,
            amount: input.amount,
            method: input.method,
            reference: input.reference,
            date: input.businessDate || new Date(),
          },
          tx
        );

        // 4. Update Order.paidAmount and paymentStatus (T030)
        const newPaidAmount = Number(order.paidAmount) + input.amount;
        const totalAmount = Number(order.totalAmount);

        let newPaymentStatus: PaymentStatus;
        if (newPaidAmount >= totalAmount) {
          newPaymentStatus = PaymentStatus.PAID_UPFRONT;
        } else if (newPaidAmount > 0) {
          newPaymentStatus = PaymentStatus.PARTIAL;
        } else {
          newPaymentStatus = PaymentStatus.PENDING;
        }

        await this.repository.updateOrderPaidAmount(
          order.id,
          newPaidAmount,
          newPaymentStatus,
          tx
        );

        // 5. Post journal entry (T028)
        await this.journalService.postUpfrontPayment(
          companyId,
          payment.id,
          order.orderNumber || order.id,
          input.amount,
          input.method,
          tx,
          input.businessDate
        );

        return payment;
      },
      { timeout: 60000 }
    );
  }

  /**
   * T032: Get payment summary for a PO.
   * Returns total, paid, remaining amounts and payment list.
   */
  async getPaymentSummary(
    companyId: string,
    orderId: string
  ): Promise<{
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    paymentStatus: PaymentStatus | null;
    payments: Payment[];
  }> {
    const order = await this.repository.findOrderWithPayments(
      orderId,
      companyId
    );

    if (!order) {
      throw new DomainError(
        'Purchase order not found',
        404,
        DomainErrorCodes.ORDER_NOT_FOUND
      );
    }

    const totalAmount = Number(order.totalAmount);
    const paidAmount = Number(order.paidAmount);

    return {
      totalAmount,
      paidAmount,
      remainingAmount: totalAmount - paidAmount,
      paymentStatus: order.paymentStatus,
      payments: order.upfrontPayments,
    };
  }

  /**
   * T033: Get prepaid info for a Bill.
   * Used on Bill detail page to show available prepaid and enable settlement.
   */
  async getPrepaidInfo(
    companyId: string,
    billId: string
  ): Promise<{
    billId: string;
    billAmount: number;
    billBalance: number;
    hasPrepaid: boolean;
    prepaid: {
      paymentId: string;
      orderId: string;
      orderNumber: string | null;
      amount: number;
      paidAt: Date;
    } | null;
    settlementAmount: number;
    remainingAfterSettlement: number;
  }> {
    const bill = await this.repository.findBillWithPrepaid(
      billId,
      companyId
    );

    if (!bill) {
      throw new DomainError(
        'Bill not found',
        404,
        DomainErrorCodes.BILL_NOT_FOUND
      );
    }

    const billAmount = Number(bill.amount);
    const billBalance = Number(bill.balance);

    // Check if linked order has prepaid
    const hasPrepaid =
      bill.order?.upfrontPayments &&
      bill.order.upfrontPayments.length > 0 &&
      bill.order.paymentTerms === PaymentTerms.UPFRONT;

    const prepaidPayment = hasPrepaid
      ? bill.order!.upfrontPayments[0]
      : null;

    const prepaidAmount = prepaidPayment
      ? Number(prepaidPayment.amount)
      : 0;

    // Settlement is min(billBalance, prepaidAmount)
    const settlementAmount = Math.min(billBalance, prepaidAmount);

    return {
      billId,
      billAmount,
      billBalance,
      hasPrepaid: !!hasPrepaid,
      prepaid: prepaidPayment
        ? {
            paymentId: prepaidPayment.id,
            orderId: prepaidPayment.orderId!,
            orderNumber: bill.order?.orderNumber || null,
            amount: prepaidAmount,
            paidAt: prepaidPayment.createdAt,
          }
        : null,
      settlementAmount,
      remainingAfterSettlement: billBalance - settlementAmount,
    };
  }

  /**
   * T034: Settle prepaid against Bill AP.
   * Posts journal: Dr AP, Cr Advances to Supplier.
   * Updates Bill balance and marks Payment as settled.
   */
  async settlePrepaid(
    companyId: string,
    billId: string,
    _userId: string
  ): Promise<{
    bill: { id: string; status: string; balance: number };
    settlement: {
      amount: number;
      journalId: string;
      prepaidPaymentId: string;
    };
  }> {
    return this.repository.withTransaction(
      async (tx) => {
        // Get prepaid info first (uses main prisma, not tx, but that's OK for read)
        const prepaidInfo = await this.getPrepaidInfo(
          companyId,
          billId
        );

        if (!prepaidInfo.hasPrepaid || !prepaidInfo.prepaid) {
          throw new DomainError(
            'No prepaid available for settlement',
            400,
            DomainErrorCodes.PAYMENT_INVALID_TYPE
          );
        }

        if (prepaidInfo.billBalance <= 0) {
          throw new DomainError(
            'Bill is already fully paid',
            422,
            DomainErrorCodes.BILL_INVALID_STATE
          );
        }

        const settlementAmount = prepaidInfo.settlementAmount;

        // 1. Get bill for number
        const bill = await this.repository.findBillById(billId, tx);

        if (!bill) {
          throw new DomainError(
            'Bill not found',
            404,
            DomainErrorCodes.BILL_NOT_FOUND
          );
        }

        // 2. Post settlement journal (use paymentId to avoid duplicate)
        const journal = await this.journalService.postSettlePrepaid(
          companyId,
          prepaidInfo.prepaid.paymentId, // Use paymentId, not billId
          bill.invoiceNumber || billId,
          settlementAmount,
          tx
        );

        // 3. Update Bill balance
        const newBalance = Number(bill.balance) - settlementAmount;
        const newStatus =
          newBalance <= 0 ? 'PAID' : String(bill.status);

        await this.repository.updateBillBalance(
          billId,
          newBalance,
          newStatus,
          tx
        );

        // 4. Mark Payment as settled
        await this.repository.markPaymentSettled(
          prepaidInfo.prepaid.paymentId,
          billId,
          tx
        );

        // 5. Update Order paymentStatus to SETTLED
        await this.repository.updateOrderPaymentStatus(
          prepaidInfo.prepaid.orderId,
          PaymentStatus.SETTLED,
          tx
        );

        return {
          bill: {
            id: billId,
            status: newStatus,
            balance: newBalance,
          },
          settlement: {
            amount: settlementAmount,
            journalId: journal.id,
            prepaidPaymentId: prepaidInfo.prepaid.paymentId,
          },
        };
      },
      { timeout: 60000 }
    );
  }
}
