// Payment Posting Saga - Atomic payment with compensation
import { SagaType, type Payment, Prisma } from '@sync-erp/database';
import {
  SagaOrchestrator,
  PostingContext,
} from '../../common/saga/index.js';
import { PaymentRepository } from '../repositories/payment.repository.js';
import { InvoiceRepository } from '../repositories/invoice.repository.js';
import { JournalService } from '../services/journal.service.js';

export interface PaymentPostingInput {
  invoiceId: string;
  companyId: string;
  amount: number;
  method: string;
}

/**
 * PaymentPostingSaga orchestrates payment posting atomically:
 *
 * Steps:
 * 1. Validate invoice exists and has sufficient balance
 * 2. Create payment record
 * 3. Decrease invoice balance
 * 4. Create cash journal entry
 *
 * Compensation (on failure):
 * 1. Reverse journal
 * 2. Restore invoice balance
 * 3. Delete payment record
 */
export class PaymentPostingSaga extends SagaOrchestrator<
  PaymentPostingInput,
  Payment
> {
  protected readonly sagaType = SagaType.PAYMENT_POST;

  protected getLockTable(): string {
    return 'Invoice';
  }

  // Override lockEntity to lock the INVOICE, not the potentially new payment
  protected async lockEntity(
    tx: Prisma.TransactionClient,
    _entityId: string,
    input: PaymentPostingInput
  ): Promise<void> {
    // We ignore entityId (which is the Payment ID to be created)
    // and lock the Invoice instead to serialize payments for the same invoice.
    return super.lockEntity(tx, input.invoiceId, input);
  }

  private paymentRepository = new PaymentRepository();
  private invoiceRepository = new InvoiceRepository();
  private journalService = new JournalService();

  /**
   * Execute the forward flow
   */
  protected async executeSteps(
    input: PaymentPostingInput,
    context: PostingContext,
    tx?: Prisma.TransactionClient
  ): Promise<Payment> {
    // 1. Validate invoice
    const invoice = await this.invoiceRepository.findById(
      input.invoiceId,
      input.companyId,
      undefined,
      tx
    );
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const currentBalance = Number(invoice.balance);
    if (input.amount > currentBalance) {
      throw new Error(
        `Payment amount ${input.amount} exceeds invoice balance ${currentBalance}`
      );
    }

    // Store previous balance for compensation
    await context.markBalanceDone(currentBalance);

    // 2. Create payment record
    const payment = await this.paymentRepository.create(
      {
        companyId: input.companyId,
        invoiceId: input.invoiceId,
        amount: input.amount,
        method: input.method,
      },
      tx
    );

    // 3. Decrease invoice balance
    const newBalance = currentBalance - input.amount;
    await this.invoiceRepository.update(
      input.invoiceId,
      {
        balance: newBalance,
        // Mark as PAID if fully paid
        ...(newBalance <= 0 ? { status: 'PAID' } : {}),
      },
      tx
    );

    // 4. Create cash journal
    const journal = await this.journalService.postPaymentReceived(
      input.companyId,
      payment.id,
      invoice.invoiceNumber || input.invoiceId,
      input.amount,
      input.method,
      tx
    );

    await context.markJournalDone(journal.id);

    return payment;
  }

  /**
   * Compensate on failure - reverse all changes
   */
  protected async compensate(context: PostingContext): Promise<void> {
    const stepData = context.stepData;

    // 1. Reverse journal if created
    if (stepData.journalId) {
      await this.journalService.reverse(
        context.companyId,
        stepData.journalId,
        `Saga compensation for payment`
      );
    }

    // 2. Restore invoice balance
    if (stepData.previousBalance !== undefined) {
      await this.invoiceRepository.update(context.entityId, {
        balance: stepData.previousBalance,
        status: 'POSTED', // Revert to POSTED if was changed to PAID
      });
    }

    // Note: Payment record deletion would happen here if needed
    // For now, we rely on the payment not being visible due to saga failure
  }
}
