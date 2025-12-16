// Bill Posting Saga - Atomic bill posting with compensation
import {
  SagaType,
  InvoiceStatus,
  type Invoice,
} from '@sync-erp/database';
import {
  SagaOrchestrator,
  PostingContext,
} from '../../common/saga/index.js';
import { InvoiceRepository } from '../repositories/invoice.repository.js';
import { JournalService } from '../services/journal.service.js';

export interface BillPostingInput {
  billId: string;
  companyId: string;
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

  private invoiceRepository = new InvoiceRepository();
  private journalService = new JournalService();

  /**
   * Execute the forward flow
   */
  protected async executeSteps(
    input: BillPostingInput,
    context: PostingContext
  ): Promise<Invoice> {
    // 1. Validate bill
    const bill = await this.invoiceRepository.findById(
      input.billId,
      input.companyId
    );
    if (!bill) {
      throw new Error('Bill not found');
    }

    if (bill.status !== InvoiceStatus.DRAFT) {
      throw new Error(`Cannot post bill with status: ${bill.status}`);
    }

    // 2. Update status to POSTED
    const updatedBill = await this.invoiceRepository.update(
      input.billId,
      {
        status: InvoiceStatus.POSTED,
      }
    );

    if (!updatedBill.invoiceNumber) {
      throw new Error(`Bill ${input.billId} has no bill number`);
    }

    // 3. Create AP journal entry
    const journal = await this.journalService.postBill(
      input.companyId,
      updatedBill.invoiceNumber,
      Number(updatedBill.amount),
      Number(updatedBill.subtotal),
      Number(updatedBill.taxAmount)
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
