import {
  prisma,
  Invoice,
  InvoiceType,
  InvoiceStatus,
  Prisma,
} from '@sync-erp/database';

export class InvoiceRepository {
  async create(
    data: Prisma.InvoiceUncheckedCreateInput
  ): Promise<Invoice> {
    return prisma.invoice.create({
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
    type?: InvoiceType
  ): Promise<Invoice | null> {
    return prisma.invoice.findFirst({
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
    status?: InvoiceStatus
  ): Promise<Invoice[]> {
    return prisma.invoice.findMany({
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
    data: Prisma.InvoiceUncheckedUpdateInput
  ): Promise<Invoice> {
    return prisma.invoice.update({
      where: { id },
      data,
      include: {
        partner: true,
        payments: true,
      },
    });
  }

  async count(companyId: string, type: InvoiceType): Promise<number> {
    return prisma.invoice.count({
      where: { companyId, type },
    });
  }

  // Helper for Order queries which are cross-module but needed for creation from Order
  async findOrder(
    id: string,
    companyId: string,
    type: import('@sync-erp/database').OrderType
  ) {
    return prisma.order.findFirst({
      where: { id, companyId, type },
      include: { items: true, partner: true },
    });
  }

  // Find invoice/bill by orderId (for duplicate check)
  async findByOrderId(
    orderId: string,
    companyId: string,
    type?: InvoiceType
  ): Promise<Invoice | null> {
    return prisma.invoice.findFirst({
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
}
