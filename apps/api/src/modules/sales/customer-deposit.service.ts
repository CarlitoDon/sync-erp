/**
 * Customer Deposit Service
 *
 * Cash Upfront Sales: Handle customer deposits for Sales Orders.
 * Accounting: Dr Cash/Bank (Asset), Cr 2200 Customer Deposits (Liability)
 */

import {
  Payment,
  PaymentStatus,
} from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';
import { SalesOrderPolicy } from './sales-order.policy';
import { CustomerDepositRepository } from './customer-deposit.repository';
import { JournalService } from '../accounting/services/journal.service';

interface RegisterDepositInput {
  orderId: string;
  amount: number;
  method: string;
  accountId?: string;
  reference?: string;
  businessDate?: Date;
}

export class CustomerDepositService {
  constructor(
    private readonly repository: CustomerDepositRepository = new CustomerDepositRepository(),
    private readonly journalService: JournalService = new JournalService()
  ) {}

  /**
   * Register a customer deposit for a Sales Order.
   * Creates Payment record linked to Order (not Invoice).
   * Posts journal: Dr Cash/Bank, Cr 2200 (Customer Deposits).
   * Updates Order.paidAmount and paymentStatus.
   */
  async registerDeposit(
    companyId: string,
    input: RegisterDepositInput,
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
            'Sales order not found',
            404,
            DomainErrorCodes.ORDER_NOT_FOUND
          );
        }

        // 2. Policy validations
        SalesOrderPolicy.ensureCanRegisterDeposit({
          status: order.status,
          paymentTerms: order.paymentTerms,
          paymentStatus: order.paymentStatus,
        });

        SalesOrderPolicy.ensureDepositWithinLimit(
          {
            totalAmount: order.totalAmount,
            paidAmount: order.paidAmount,
          },
          input.amount
        );

        // 3. Create Payment record via repository
        const payment = await this.repository.createDeposit(
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

        // 4. Update Order.paidAmount and paymentStatus
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

        // 5. Post journal entry: Dr Cash/Bank, Cr 2200 Customer Deposits
        await this.journalService.postCustomerDeposit(
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
   * Get deposit summary for a Sales Order.
   * Returns total, paid, remaining amounts and payment list.
   */
  async getDepositSummary(
    companyId: string,
    orderId: string
  ): Promise<{
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    paymentStatus: PaymentStatus | null;
    payments: Payment[];
  }> {
    const order = await this.repository.findOrderWithDeposits(
      orderId,
      companyId
    );

    if (!order) {
      throw new DomainError(
        'Sales order not found',
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
   * Get deposit info for an Invoice.
   * Used on Invoice detail page to show available deposit and enable settlement.
   */
  async getDepositInfo(
    companyId: string,
    invoiceId: string
  ): Promise<{
    invoiceId: string;
    invoiceAmount: number;
    invoiceBalance: number;
    hasDeposit: boolean;
    deposit: {
      paymentId: string;
      orderId: string;
      orderNumber: string | null;
      amount: number;
      paidAt: Date;
    } | null;
    settlementAmount: number;
    remainingAfterSettlement: number;
  }> {
    const invoice = await this.repository.findInvoiceWithDeposit(
      invoiceId,
      companyId
    );

    if (!invoice) {
      throw new DomainError(
        'Invoice not found',
        404,
        DomainErrorCodes.INVOICE_NOT_FOUND
      );
    }

    const invoiceAmount = Number(invoice.amount);
    const invoiceBalance = Number(invoice.balance);

    // Check if linked order has deposit
    const hasDeposit =
      invoice.order?.upfrontPayments &&
      invoice.order.upfrontPayments.length > 0;
    // GAP-3 Fix: Allow for any payment terms
    // && invoice.order.paymentTerms === PaymentTerms.UPFRONT;

    const depositPayment = hasDeposit
      ? invoice.order!.upfrontPayments[0]
      : null;

    const depositAmount = depositPayment
      ? Number(depositPayment.amount)
      : 0;

    // Settlement is min(invoiceBalance, depositAmount)
    const settlementAmount = Math.min(invoiceBalance, depositAmount);

    return {
      invoiceId,
      invoiceAmount,
      invoiceBalance,
      hasDeposit: !!hasDeposit,
      deposit: depositPayment
        ? {
            paymentId: depositPayment.id,
            orderId: depositPayment.orderId!,
            orderNumber: invoice.order?.orderNumber || null,
            amount: depositAmount,
            paidAt: depositPayment.createdAt,
          }
        : null,
      settlementAmount,
      remainingAfterSettlement: invoiceBalance - settlementAmount,
    };
  }

  /**
   * Settle customer deposit against Invoice AR.
   * Posts journal: Dr 2200 (Customer Deposits), Cr 1300 (AR).
   * Updates Invoice balance and marks Payment as settled.
   */
  async settleDeposit(
    companyId: string,
    invoiceId: string,
    _userId: string
  ): Promise<{
    invoice: { id: string; status: string; balance: number };
    settlement: {
      amount: number;
      journalId: string;
      depositPaymentId: string;
    };
  }> {
    return this.repository.withTransaction(
      async (tx) => {
        // Get deposit info first (uses main prisma, not tx, but that's OK for read)
        const depositInfo = await this.getDepositInfo(
          companyId,
          invoiceId
        );

        if (!depositInfo.hasDeposit || !depositInfo.deposit) {
          throw new DomainError(
            'No deposit available for settlement',
            400,
            DomainErrorCodes.PAYMENT_INVALID_TYPE
          );
        }

        if (depositInfo.invoiceBalance <= 0) {
          throw new DomainError(
            'Invoice is already fully paid',
            422,
            DomainErrorCodes.INVOICE_INVALID_STATE
          );
        }

        const settlementAmount = depositInfo.settlementAmount;

        // 1. Get invoice for number
        const invoice = await this.repository.findInvoiceById(
          invoiceId,
          tx
        );

        if (!invoice) {
          throw new DomainError(
            'Invoice not found',
            404,
            DomainErrorCodes.INVOICE_NOT_FOUND
          );
        }

        // 2. Post settlement journal (use paymentId to avoid duplicate)
        const journal =
          await this.journalService.postSettleCustomerDeposit(
            companyId,
            depositInfo.deposit.paymentId, // Use paymentId, not invoiceId
            invoice.invoiceNumber || invoiceId,
            settlementAmount,
            tx
          );

        // 3. Update Invoice balance
        const newBalance = Number(invoice.balance) - settlementAmount;
        const newStatus =
          newBalance <= 0 ? 'PAID' : String(invoice.status);

        await this.repository.updateInvoiceBalance(
          invoiceId,
          newBalance,
          newStatus,
          tx
        );

        // 4. Mark Payment as settled
        await this.repository.markDepositSettled(
          depositInfo.deposit.paymentId,
          invoiceId,
          tx
        );

        // 5. Update Order paymentStatus to SETTLED
        await this.repository.updateOrderPaymentStatus(
          depositInfo.deposit.orderId,
          PaymentStatus.SETTLED,
          tx
        );

        return {
          invoice: {
            id: invoiceId,
            status: newStatus,
            balance: newBalance,
          },
          settlement: {
            amount: settlementAmount,
            journalId: journal.id,
            depositPaymentId: depositInfo.deposit.paymentId,
          },
        };
      },
      { timeout: 60000 }
    );
  }
}
