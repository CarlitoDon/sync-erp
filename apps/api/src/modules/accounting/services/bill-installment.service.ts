import {
  BillInstallmentSchedule,
  BillInstallmentStatus,
  InvoiceStatus,
  InvoiceType,
  Prisma,
  prisma,
} from '@sync-erp/database';
import {
  CancelBillInstallmentInput,
  CreateBillInstallmentScheduleInput,
  DomainError,
  DomainErrorCodes,
  MarkBillInstallmentPaidInput,
} from '@sync-erp/shared';
import { Decimal } from 'decimal.js';

export interface BillInstallmentSummary {
  scheduledAmount: number;
  paidScheduledAmount: number;
  remainingScheduledAmount: number;
  nextDueDate: Date | null;
  overdueCount: number;
}

export const EMPTY_BILL_INSTALLMENT_SUMMARY: BillInstallmentSummary = {
  scheduledAmount: 0,
  paidScheduledAmount: 0,
  remainingScheduledAmount: 0,
  nextDueDate: null,
  overdueCount: 0,
};

export class BillInstallmentService {
  async list(
    companyId: string,
    billId: string
  ): Promise<BillInstallmentSchedule[]> {
    await this.ensureBill(companyId, billId);
    return prisma.billInstallmentSchedule.findMany({
      where: { companyId, billId },
      orderBy: { sequence: 'asc' },
    });
  }

  async createSchedule(
    companyId: string,
    input: CreateBillInstallmentScheduleInput
  ): Promise<BillInstallmentSchedule[]> {
    return prisma.$transaction(async (tx) => {
      const bill = await this.ensureBill(companyId, input.billId, tx);

      if (bill.status === InvoiceStatus.VOID) {
        throw new DomainError(
          'Cannot create installment schedule for void bill',
          400,
          DomainErrorCodes.BILL_INVALID_STATE
        );
      }

      const existing = await tx.billInstallmentSchedule.findMany({
        where: { companyId, billId: input.billId },
        orderBy: { sequence: 'asc' },
      });

      if (existing.length > 0 && !input.replaceExisting) {
        throw new DomainError(
          'Bill already has an installment schedule',
          409,
          DomainErrorCodes.ALREADY_EXISTS
        );
      }

      if (
        input.replaceExisting &&
        existing.some((item) => item.status === BillInstallmentStatus.PAID)
      ) {
        throw new DomainError(
          'Cannot replace schedule with paid installments',
          400,
          DomainErrorCodes.BILL_INVALID_STATE
        );
      }

      const scheduledTotal = input.installments.reduce(
        (sum, item) => sum.plus(item.amount),
        new Decimal(0)
      );
      const billAmount = new Decimal(bill.amount);
      if (scheduledTotal.gt(billAmount)) {
        throw new DomainError(
          `Installment total ${scheduledTotal.toNumber()} exceeds bill amount ${billAmount.toNumber()}`,
          422,
          DomainErrorCodes.BILL_INVALID_STATE
        );
      }

      if (input.replaceExisting) {
        await tx.billInstallmentSchedule.deleteMany({
          where: { companyId, billId: input.billId },
        });
      }

      const now = new Date();
      await tx.billInstallmentSchedule.createMany({
        data: input.installments.map((item, index) => ({
          companyId,
          billId: input.billId,
          sequence: index + 1,
          dueDate: item.dueDate,
          amount: item.amount,
          notes: item.notes,
          updatedAt: now,
        })),
      });

      return tx.billInstallmentSchedule.findMany({
        where: { companyId, billId: input.billId },
        orderBy: { sequence: 'asc' },
      });
    });
  }

  async markPaid(
    companyId: string,
    input: MarkBillInstallmentPaidInput
  ): Promise<BillInstallmentSchedule> {
    return prisma.$transaction(async (tx) => {
      const installment = await tx.billInstallmentSchedule.findFirst({
        where: { id: input.installmentId, companyId },
      });
      if (!installment) {
        throw new DomainError(
          'Bill installment not found',
          404,
          DomainErrorCodes.NOT_FOUND
        );
      }
      if (installment.status !== BillInstallmentStatus.PENDING) {
        throw new DomainError(
          `Cannot mark ${installment.status} installment as paid`,
          400,
          DomainErrorCodes.BILL_INVALID_STATE
        );
      }

      const payment = await tx.payment.findFirst({
        where: {
          id: input.paymentId,
          companyId,
          invoiceId: installment.billId,
        },
        select: { id: true, date: true },
      });
      if (!payment) {
        throw new DomainError(
          'Payment not found for this bill',
          404,
          DomainErrorCodes.PAYMENT_NOT_FOUND
        );
      }

      return tx.billInstallmentSchedule.update({
        where: { id: installment.id },
        data: {
          status: BillInstallmentStatus.PAID,
          paidAt: input.paidAt ?? payment.date,
          paymentId: payment.id,
        },
      });
    });
  }

  async cancel(
    companyId: string,
    input: CancelBillInstallmentInput
  ): Promise<BillInstallmentSchedule> {
    const installment = await prisma.billInstallmentSchedule.findFirst({
      where: { id: input.installmentId, companyId },
    });
    if (!installment) {
      throw new DomainError(
        'Bill installment not found',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }
    if (installment.status === BillInstallmentStatus.PAID) {
      throw new DomainError(
        'Cannot cancel paid installment',
        400,
        DomainErrorCodes.BILL_INVALID_STATE
      );
    }

    return prisma.billInstallmentSchedule.update({
      where: { id: installment.id },
      data: {
        status: BillInstallmentStatus.CANCELLED,
        notes: input.notes ?? installment.notes,
      },
    });
  }

  async getSummaryForBills(
    companyId: string,
    billIds: string[]
  ): Promise<Map<string, BillInstallmentSummary>> {
    const summaries = new Map<string, BillInstallmentSummary>();
    for (const billId of billIds) {
      summaries.set(billId, { ...EMPTY_BILL_INSTALLMENT_SUMMARY });
    }
    if (billIds.length === 0) return summaries;

    const installments = await prisma.billInstallmentSchedule.findMany({
      where: { companyId, billId: { in: billIds } },
      orderBy: [{ billId: 'asc' }, { sequence: 'asc' }],
    });

    const now = new Date();
    for (const installment of installments) {
      const summary =
        summaries.get(installment.billId) ??
        { ...EMPTY_BILL_INSTALLMENT_SUMMARY };

      if (installment.status !== BillInstallmentStatus.CANCELLED) {
        summary.scheduledAmount += Number(installment.amount);
      }
      if (installment.status === BillInstallmentStatus.PAID) {
        summary.paidScheduledAmount += Number(installment.amount);
      }
      if (installment.status === BillInstallmentStatus.PENDING) {
        if (
          !summary.nextDueDate ||
          installment.dueDate < summary.nextDueDate
        ) {
          summary.nextDueDate = installment.dueDate;
        }
        if (installment.dueDate < now) {
          summary.overdueCount += 1;
        }
      }

      summary.remainingScheduledAmount =
        summary.scheduledAmount - summary.paidScheduledAmount;
      summaries.set(installment.billId, summary);
    }

    return summaries;
  }

  private async ensureBill(
    companyId: string,
    billId: string,
    tx: Prisma.TransactionClient | typeof prisma = prisma
  ) {
    const bill = await tx.invoice.findFirst({
      where: { id: billId, companyId, type: InvoiceType.BILL },
      select: {
        id: true,
        amount: true,
        status: true,
      },
    });
    if (!bill) {
      throw new DomainError(
        'Bill not found',
        404,
        DomainErrorCodes.BILL_NOT_FOUND
      );
    }
    return bill;
  }
}
