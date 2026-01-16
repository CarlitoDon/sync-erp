/**
 * Customer Deposit Repository
 *
 * Feature: Cash Upfront Sales - Data access layer for customer deposit operations.
 * Similar pattern to procurement/upfront-payment.repository.ts but for Sales Orders.
 */

import { Prisma } from '@sync-erp/database';
import {
  Payment,
  PaymentStatus,
  PaymentMethod,
  PaymentTerms,
  InvoiceStatus,
  InvoiceType,
  OrderType,
  prisma,
} from '@sync-erp/database';

export class CustomerDepositRepository {
  /**
   * Find order by ID with lock for update
   */
  async findOrderForUpdate(
    orderId: string,
    companyId: string,
    tx: Prisma.TransactionClient
  ) {
    await tx.$executeRaw`SELECT 1 FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    return tx.order.findFirst({
      where: { id: orderId, companyId, type: OrderType.SALES },
    });
  }

  /**
   * Find order by ID with customer deposits (upfront payments)
   */
  async findOrderWithDeposits(orderId: string, companyId: string) {
    return prisma.order.findFirst({
      where: { id: orderId, companyId, type: OrderType.SALES },
      include: {
        upfrontPayments: {
          where: { paymentType: PaymentTerms.UPFRONT },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * Create customer deposit (upfront payment) record
   */
  async createDeposit(
    data: {
      companyId: string;
      orderId: string;
      amount: number;
      method: string;
      reference?: string;
      date: Date;
    },
    tx: Prisma.TransactionClient
  ): Promise<Payment> {
    return tx.payment.create({
      data: {
        companyId: data.companyId,
        orderId: data.orderId,
        invoiceId: null,
        amount: data.amount,
        method: data.method as PaymentMethod,
        paymentType: PaymentTerms.UPFRONT,
        reference: data.reference,
        date: data.date,
      },
    });
  }

  /**
   * Update order paid amount and status
   */
  async updateOrderPaidAmount(
    orderId: string,
    paidAmount: number,
    paymentStatus: PaymentStatus,
    tx: Prisma.TransactionClient
  ) {
    return tx.order.update({
      where: { id: orderId },
      data: {
        paidAmount,
        paymentStatus,
      },
    });
  }

  /**
   * Find invoice with linked order and customer deposits
   */
  async findInvoiceWithDeposit(invoiceId: string, companyId: string) {
    return prisma.invoice.findFirst({
      where: { id: invoiceId, companyId, type: InvoiceType.INVOICE },
      include: {
        order: {
          include: {
            upfrontPayments: {
              where: {
                paymentType: PaymentTerms.UPFRONT,
                settledAt: null,
              },
              orderBy: { createdAt: 'asc' },
              take: 1,
            },
          },
        },
      },
    });
  }

  /**
   * Find invoice by ID
   */
  async findInvoiceById(
    invoiceId: string,
    tx: Prisma.TransactionClient
  ) {
    return tx.invoice.findFirst({
      where: { id: invoiceId },
    });
  }

  /**
   * Update invoice balance after settlement
   */
  async updateInvoiceBalance(
    invoiceId: string,
    newBalance: number,
    newStatus: string,
    tx: Prisma.TransactionClient
  ) {
    return tx.invoice.update({
      where: { id: invoiceId },
      data: {
        balance: newBalance,
        status: newStatus as InvoiceStatus,
      },
    });
  }

  /**
   * Mark deposit as settled against invoice
   * Note: Uses settlementBillId field (generic for Invoice/Bill)
   */
  async markDepositSettled(
    paymentId: string,
    invoiceId: string,
    tx: Prisma.TransactionClient
  ) {
    return tx.payment.update({
      where: { id: paymentId },
      data: {
        settledAt: new Date(),
        settlementBillId: invoiceId, // Field handles both Invoice and Bill
      },
    });
  }

  /**
   * Update order payment status
   */
  async updateOrderPaymentStatus(
    orderId: string,
    paymentStatus: PaymentStatus,
    tx: Prisma.TransactionClient
  ) {
    return tx.order.update({
      where: { id: orderId },
      data: { paymentStatus },
    });
  }

  /**
   * Get prisma transaction wrapper
   */
  async withTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { timeout?: number }
  ): Promise<T> {
    return prisma.$transaction(fn, options);
  }
}
