/**
 * Upfront Payment Repository
 *
 * Feature 036: Data access layer for upfront payment operations.
 */

import {
  Payment,
  PaymentStatus,
  Prisma,
  prisma,
} from '@sync-erp/database';

export class UpfrontPaymentRepository {
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
      where: { id: orderId, companyId },
    });
  }

  /**
   * Find order by ID with upfront payments
   */
  async findOrderWithPayments(orderId: string, companyId: string) {
    return prisma.order.findFirst({
      where: { id: orderId, companyId },
      include: {
        upfrontPayments: {
          where: { paymentType: 'UPFRONT' },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * Create upfront payment record
   */
  async createPayment(
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
        method: data.method as any, // PaymentMethod enum
        paymentType: 'UPFRONT',
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
   * Find bill with linked order and prepaid payments
   */
  async findBillWithPrepaid(billId: string, companyId: string) {
    return prisma.invoice.findFirst({
      where: { id: billId, companyId, type: 'BILL' },
      include: {
        order: {
          include: {
            upfrontPayments: {
              where: {
                paymentType: 'UPFRONT',
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
   * Find bill by ID
   */
  async findBillById(billId: string, tx: Prisma.TransactionClient) {
    return tx.invoice.findFirst({
      where: { id: billId },
    });
  }

  /**
   * Update bill balance after settlement
   */
  async updateBillBalance(
    billId: string,
    newBalance: number,
    newStatus: string,
    tx: Prisma.TransactionClient
  ) {
    return tx.invoice.update({
      where: { id: billId },
      data: {
        balance: newBalance,
        status: newStatus as any,
      },
    });
  }

  /**
   * Mark payment as settled
   */
  async markPaymentSettled(
    paymentId: string,
    billId: string,
    tx: Prisma.TransactionClient
  ) {
    return tx.payment.update({
      where: { id: paymentId },
      data: {
        settledAt: new Date(),
        settlementBillId: billId,
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
