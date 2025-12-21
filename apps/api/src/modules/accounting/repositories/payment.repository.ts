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
    companyId: string,
    tx?: Prisma.TransactionClient
  ): Promise<Payment | null> {
    const db = tx || prisma;
    return db.payment.findFirst({
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

  /**
   * Void a payment: mark as voided and restore invoice balance
   * This is a transactional operation to ensure consistency.
   */
  async voidPayment(
    id: string,
    invoiceId: string,
    amount: number,
    tx?: Prisma.TransactionClient
  ): Promise<Payment> {
    const execute = async (db: Prisma.TransactionClient) => {
      // 1. Get current reference to prepend [VOIDED]
      const current = await db.payment.findUnique({ where: { id } });
      const voidedRef = `[VOIDED] ${current?.reference || 'Payment'}`;

      // 2. Mark payment as voided by updating reference
      const updated = await db.payment.update({
        where: { id },
        data: { reference: voidedRef },
      });

      // 3. Restore invoice balance
      await db.invoice.update({
        where: { id: invoiceId },
        data: {
          balance: { increment: amount },
        },
      });

      return updated;
    };

    if (tx) {
      return execute(tx);
    }
    return prisma.$transaction(execute);
  }
}
