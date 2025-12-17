// Bill Posting Saga - Atomic bill posting with compensation
import {
  SagaType,
  InvoiceStatus,
  type Invoice,
  Prisma,
} from '@sync-erp/database';
import { Money, BusinessDate } from '@sync-erp/shared';
import {
  SagaOrchestrator,
  PostingContext,
} from '../../common/saga/index.js';
import { InvoiceRepository } from '../repositories/invoice.repository.js';
import { JournalService } from '../services/journal.service.js';

export interface BillPostingInput {
  billId: string;
  companyId: string;
  businessDate?: Date; // G5
}

/**
 * BillPostingSaga orchestrates bill posting atomically:
 *
 * Steps:
 * 1. Validate bill exists and is DRAFT
 * 2. Update bill status to POSTED
 * 3. Create AP journal entry
 *
 * Compensation (on failure):
 * 1. Reverse journal
 * 2. Revert bill status to DRAFT
 */
export class BillPostingSaga extends SagaOrchestrator<
  BillPostingInput,
  Invoice
> {
  protected readonly sagaType = SagaType.BILL_POST;

  protected getLockTable(): string {
    return 'Invoice';
  }

  private invoiceRepository = new InvoiceRepository();
  private journalService = new JournalService();

  /**
   * Execute the forward flow
   */
  protected async executeSteps(
    input: BillPostingInput,
    context: PostingContext,
    tx?: Prisma.TransactionClient
  ): Promise<Invoice> {
    // Phase 1 Guard: Backdated
    if (input.businessDate) {
      BusinessDate.from(input.businessDate).ensureNotBackdated();
    }

    // 1. Validate bill
    const bill = await this.invoiceRepository.findById(
      input.billId,
      input.companyId,
      undefined,
      tx
    );
    if (!bill) {
      throw new Error('Bill not found');
    }

    if (bill.status !== InvoiceStatus.DRAFT) {
      throw new Error(`Cannot post bill with status: ${bill.status}`);
    }

    // Phase 1 Guard: Block Multi-Currency
    // Note: Schema might default to IDR implies no currency column yet,
    // but we guard against runtime/future columns.
    const currency =
      (bill as Invoice & { currency?: string }).currency || 'IDR';
    Money.from(0, currency).ensureBase();

    // 2. Update status to POSTED
    const updatedBill = await this.invoiceRepository.update(
      input.billId,
      {
        status: InvoiceStatus.POSTED,
      },
      tx
    );

    if (!updatedBill.invoiceNumber) {
      throw new Error(`Bill ${input.billId} has no bill number`);
    }

    // 3. Create AP journal entry
    const journal = await this.journalService.postBill(
      input.companyId,
      input.billId,
      updatedBill.invoiceNumber,
      Number(updatedBill.amount),
      Number(updatedBill.subtotal),
      Number(updatedBill.taxAmount),
      tx,
      input.businessDate // G5
    );

    await context.markJournalDone(journal.id);

    return updatedBill;
  }

  /**
   * Compensate on failure - reverse journal and status
   */
  protected async compensate(context: PostingContext): Promise<void> {
    const stepData = context.stepData;

    // 1. Reverse journal if created
    if (stepData.journalId) {
      await this.journalService.reverse(
        context.companyId,
        stepData.journalId,
        `Saga compensation for bill ${context.entityId}`
      );
    }

    // 2. Revert bill status to DRAFT
    await this.invoiceRepository.update(context.entityId, {
      status: InvoiceStatus.DRAFT,
    });
  }
}
