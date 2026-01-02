import {
  prisma,
  Invoice,
  InvoiceType,
  InvoiceStatus,
  Prisma,
} from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

export class InvoiceRepository {
  async create(
    data: Prisma.InvoiceUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.invoice.create({
      data,
      include: {
        order: { include: { items: { include: { product: true } } } },
        partner: true,
        items: { include: { product: true } },
      },
    });
  }

  async findById(
    id: string,
    companyId: string,
    type?: InvoiceType,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.invoice.findFirst({
      where: {
        id,
        companyId,
        ...(type && { type }),
      },
      include: {
        order: { include: { items: { include: { product: true } } } },
        partner: true,
        payments: true,
        items: { include: { product: true } },
        dpBill: true, // Include related DP Bill
        finalBills: true, // Include related Final Bills if this is a DP
        fulfillment: true, // Include linked GRN
      },
    });
  }

  async findAll(
    companyId: string,
    type?: InvoiceType,
    status?: InvoiceStatus,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.invoice.findMany({
      where: {
        companyId,
        ...(type && { type }),
        ...(status && { status }),
      },
      include: {
        partner: true,
        payments: true,
        order: true,
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    id: string,
    data: Prisma.InvoiceUncheckedUpdateInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.invoice.update({
      where: { id },
      data,
      include: {
        partner: true,
        payments: true,
        order: true,
        items: { include: { product: true } },
      },
    });
  }

  /**
   * Update invoice status with optimistic locking (FR-027)
   * Validates version to prevent concurrent modification conflicts.
   */
  async updateStatus(
    id: string,
    status: InvoiceStatus,
    expectedVersion?: number,
    tx?: Prisma.TransactionClient
  ): Promise<Invoice> {
    const db = tx || prisma;

    if (expectedVersion !== undefined) {
      const result = await db.invoice.updateMany({
        where: { id, version: expectedVersion },
        data: { status, version: { increment: 1 } },
      });

      if (result.count === 0) {
        throw new DomainError(
          'Concurrency Error: Invoice/Bill has been modified by another process',
          409,
          DomainErrorCodes.OPERATION_NOT_ALLOWED
        );
      }

      return db.invoice.findUniqueOrThrow({
        where: { id },
        include: {
          partner: true,
          payments: true,
          order: true,
          items: { include: { product: true } },
        },
      });
    }

    return db.invoice.update({
      where: { id },
      data: { status, version: { increment: 1 } },
      include: {
        partner: true,
        payments: true,
        order: true,
        items: { include: { product: true } },
      },
    });
  }

  async count(
    companyId: string,
    type: InvoiceType,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const db = tx || prisma;
    return db.invoice.count({
      where: { companyId, type },
    });
  }

  // Helper for Order queries which are cross-module but needed for creation from Order
  async findOrder(
    id: string,
    companyId: string,
    type: import('@sync-erp/database').OrderType,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.order.findFirst({
      where: { id, companyId, type },
      include: { items: true, partner: true },
    });
  }

  // Find invoice/bill by orderId (for duplicate check)
  async findByOrderId(
    orderId: string,
    companyId: string,
    type?: InvoiceType,
    tx?: Prisma.TransactionClient
  ): Promise<Invoice | null> {
    const db = tx || prisma;
    return db.invoice.findFirst({
      where: {
        orderId,
        companyId,
        ...(type && { type }),
      },
      include: {
        partner: true,
        order: true,
      },
    });
  }

  // Generic findFirst for flexible queries
  async findFirst(
    where: {
      orderId?: string;
      companyId?: string;
      type?: InvoiceType;
      status?: InvoiceStatus;
      notes?: { contains: string };
      isDownPayment?: boolean;
    },
    tx?: Prisma.TransactionClient
  ): Promise<Invoice | null> {
    const db = tx || prisma;
    return db.invoice.findFirst({
      where,
      include: {
        partner: true,
        order: true,
        dpBill: true,
      },
    });
  }

  async decreaseBalanceWithGuard(
    id: string,
    amount: number,
    tx?: Prisma.TransactionClient
  ): Promise<Invoice> {
    const db = tx || prisma;
    return db.invoice.update({
      where: {
        id,
        balance: { gte: amount }, // Concurrency Guard
      },
      data: {
        balance: { decrement: amount },
      },
      include: { partner: true, payments: true }, // Ensure consistent return type
    });
  }

  // Helper for Shipment creation in Invoice Posting Saga
  async findOrderWithItems(
    orderId: string,
    companyId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.order.findFirst({
      where: { id: orderId, companyId },
      include: { items: true },
    });
  }

  /**
   * Count payments for an invoice/bill
   * Used to check if void is allowed.
   * Note: All payments count - payments are not voidable in current schema.
   */
  async countPayments(
    invoiceId: string,
    _companyId: string,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const db = tx || prisma;
    return db.payment.count({
      where: {
        invoiceId,
        NOT: {
          reference: {
            startsWith: '[VOIDED]',
          },
        },
      },
    });
  }

  /**
   * FR-013: Find Bill by supplier invoice number for duplicate check.
   * Checks for duplicates per supplier (partnerId).
   */
  async findBySupplierInvoiceNumber(
    companyId: string,
    partnerId: string,
    supplierInvoiceNumber: string,
    tx?: Prisma.TransactionClient
  ): Promise<Invoice | null> {
    const db = tx || prisma;
    return db.invoice.findFirst({
      where: {
        companyId,
        partnerId,
        supplierInvoiceNumber,
        type: InvoiceType.BILL,
      },
    });
  }

  /**
   * Calculate total DP already deducted from Bills for this Order.
   * This is used to prevent over-deducting DP in multi-bill scenarios.
   */
  async sumDeductedDpByOrderId(
    orderId: string,
    companyId: string,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const db = tx || prisma;
    const bills = await db.invoice.findMany({
      where: {
        orderId,
        companyId,
        type: InvoiceType.BILL,
        isDownPayment: false,
        status: { not: InvoiceStatus.VOID },
        dpBillId: { not: null },
      },
      select: {
        amount: true,
        subtotal: true,
        taxRate: true,
      },
    });

    return bills.reduce((sum, bill) => {
      const taxMultiplier =
        Number(bill.taxRate) > 1
          ? Number(bill.taxRate) / 100
          : Number(bill.taxRate);
      const grossBeforeDeduction =
        Number(bill.subtotal) * (1 + taxMultiplier);
      const dpDeducted = grossBeforeDeduction - Number(bill.amount);
      return sum + (dpDeducted > 1 ? dpDeducted : 0); // Guard against tiny floating point errors
    }, 0);
  }

  /**
   * Feature 041: Sum total invoiced/billed amount for an Order.
   * Used for over-billing/over-invoicing prevention.
   * Excludes VOID invoices and DP invoices (which are tracked separately).
   */
  async sumInvoicedByOrderId(
    orderId: string,
    companyId: string,
    invoiceType: InvoiceType,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const db = tx || prisma;
    const result = await db.invoice.aggregate({
      where: {
        orderId,
        companyId,
        type: invoiceType,
        isDownPayment: false,
        status: { not: InvoiceStatus.VOID },
      },
      _sum: {
        subtotal: true,
      },
    });
    return Number(result._sum.subtotal || 0);
  }
}
