// Credit Note Saga - Atomic credit note with compensation
import {
  SagaType,
  InvoiceStatus,
  type Invoice,
  Prisma,
} from '@sync-erp/database';
import { Money } from '@sync-erp/shared';
import {
  SagaOrchestrator,
  PostingContext,
} from '../../common/saga/index.js';
import { InvoiceRepository } from '../repositories/invoice.repository.js';
import { JournalService } from '../services/journal.service.js';

export interface CreditNoteInput {
  invoiceId: string;
  companyId: string;
  amount: number;
  reason: string;
}

/**
 * CreditNoteSaga orchestrates credit note creation atomically:
 *
 * Steps:
 * 1. Validate original invoice exists
 * 2. Create credit note record
 * 3. Create reversing journal entry
 * 4. Adjust original invoice balance
 *
 * Compensation (on failure):
 * 1. Reverse journal
 * 2. Restore invoice balance
 */
export class CreditNoteSaga extends SagaOrchestrator<
  CreditNoteInput,
  Invoice
> {
  protected readonly sagaType = SagaType.CREDIT_NOTE;

  protected getLockTable(): string {
    return 'Invoice';
  }

  private invoiceRepository = new InvoiceRepository();
  private journalService = new JournalService();

  protected async executeSteps(
    input: CreditNoteInput,
    context: PostingContext,
    tx?: Prisma.TransactionClient
  ): Promise<Invoice> {
    // 1. Validate original invoice
    const invoice = await this.invoiceRepository.findById(
      input.invoiceId,
      input.companyId,
      undefined,
      tx
    );
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status === InvoiceStatus.VOID) {
      throw new Error('Cannot create credit note for voided invoice');
    }

    // Phase 1 Guard: Block Multi-Currency
    const currency =
      (invoice as Invoice & { currency?: string }).currency || 'IDR';
    Money.from(0, currency).ensureBase();

    // Store original balance for compensation
    await context.markBalanceDone(Number(invoice.balance));

    // 2. Create reversing journal entry
    const journal = await this.journalService.postCreditNote(
      input.companyId,
      context.id, // creditNoteId
      invoice.invoiceNumber || input.invoiceId,
      input.amount,
      undefined, // subtotal
      undefined, // taxAmount
      tx
    );

    await context.markJournalDone(journal.id);

    // 3. Reduce invoice balance
    const newBalance = Math.max(
      0,
      Number(invoice.balance) - input.amount
    );
    const updatedInvoice = await this.invoiceRepository.update(
      input.invoiceId,
      {
        balance: newBalance,
        ...(newBalance <= 0 ? { status: InvoiceStatus.PAID } : {}),
      },
      tx
    );

    return updatedInvoice;
  }

  protected async compensate(context: PostingContext): Promise<void> {
    const stepData = context.stepData;

    // 1. Reverse journal if created
    if (stepData.journalId) {
      await this.journalService.reverse(
        context.companyId,
        stepData.journalId,
        `Compensation for credit note saga`
      );
    }

    // 2. Restore invoice balance
    if (stepData.previousBalance !== undefined) {
      await this.invoiceRepository.update(context.entityId, {
        balance: stepData.previousBalance,
        status: InvoiceStatus.POSTED,
      });
    }
  }
}
