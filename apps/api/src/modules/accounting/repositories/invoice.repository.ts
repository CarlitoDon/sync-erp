import {
  prisma,
  Invoice,
  InvoiceType,
  InvoiceStatus,
  Prisma,
} from '@sync-erp/database';

export class InvoiceRepository {
  async create(
    data: Prisma.InvoiceUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ): Promise<Invoice> {
    const db = tx || prisma;
    return db.invoice.create({
      data,
      include: {
        order: { include: { items: { include: { product: true } } } },
        partner: true,
      },
    });
  }

  async findById(
    id: string,
    companyId: string,
    type?: InvoiceType,
    tx?: Prisma.TransactionClient
  ): Promise<Invoice | null> {
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
      },
    });
  }

  async findAll(
    companyId: string,
    type?: InvoiceType,
    status?: InvoiceStatus,
    tx?: Prisma.TransactionClient
  ): Promise<Invoice[]> {
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
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    id: string,
    data: Prisma.InvoiceUncheckedUpdateInput,
    tx?: Prisma.TransactionClient
  ): Promise<Invoice> {
    const db = tx || prisma;
    return db.invoice.update({
      where: { id },
      data,
      include: {
        partner: true,
        payments: true,
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
}
