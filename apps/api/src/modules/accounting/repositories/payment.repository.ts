import { prisma, Payment, Prisma } from '@sync-erp/database';

export class PaymentRepository {
  async create(
    data: Prisma.PaymentUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ): Promise<Payment> {
    const db = tx || prisma;
    return db.payment.create({ data });
  }

  async findById(
    id: string,
    companyId: string
  ): Promise<Payment | null> {
    return prisma.payment.findFirst({
      where: { id, companyId },
      include: { invoice: true },
    });
  }

  async findAll(
    companyId: string,
    invoiceId?: string
  ): Promise<Payment[]> {
    return prisma.payment.findMany({
      where: {
        companyId,
        ...(invoiceId && { invoiceId }),
      },
      include: {
        invoice: { include: { partner: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
