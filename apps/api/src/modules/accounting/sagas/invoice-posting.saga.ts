// Invoice Posting Saga - Atomic invoice posting with compensation
import {
  SagaType,
  Invoice,
  InvoiceStatus,
  Prisma,
  BusinessShape,
} from '@sync-erp/database';
import {
  SagaOrchestrator,
  PostingContext,
} from '../../common/saga/index.js';
import { InvoiceRepository } from '../repositories/invoice.repository.js';
import { InventoryService } from '../../inventory/inventory.service.js';
import { JournalService } from '../services/journal.service.js';

export interface InvoicePostingInput {
  invoiceId: string;
  companyId: string;
  shape?: BusinessShape;
  configs?: { key: string; value: Prisma.JsonValue }[];
  businessDate?: Date; // G5
}

/**
 * InvoicePostingSaga orchestrates invoice posting atomically:
 *
 * Steps:
 * 1. Validate invoice is DRAFT
 * 2. Stock OUT (shipment) if order-linked
 * 3. Journal entry (Revenue, AR)
 *
 * Compensation (on failure):
 * 1. Reverse journal (if created)
 * 2. Restore stock (if shipped)
 */
export class InvoicePostingSaga extends SagaOrchestrator<
  InvoicePostingInput,
  Invoice
> {
  protected readonly sagaType = SagaType.INVOICE_POST;

  protected getLockTable(): string {
    return 'Invoice';
  }

  private invoiceRepository = new InvoiceRepository();
  private journalService = new JournalService();
  private inventoryService = new InventoryService();

  /**
   * Execute the forward flow
   */
  protected async executeSteps(
    input: InvoicePostingInput,
    context: PostingContext,
    tx?: Prisma.TransactionClient
  ): Promise<Invoice> {
    // 1. Validate invoice
    const invoice = await this.invoiceRepository.findById(
      input.invoiceId,
      input.companyId,
      'INVOICE',
      tx
    );
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new Error(
        `Cannot post invoice with status: ${invoice.status}`
      );
    }

    // 2. Stock OUT (if order-linked)
    if (invoice.orderId) {
      const movements = await this.inventoryService.processShipment(
        input.companyId,
        invoice.orderId,
        `Shipment for Invoice ${invoice.invoiceNumber}`,
        undefined, // Shape
        undefined, // Configs
        tx
      );

      // Track first movement ID for compensation
      if (movements.length > 0) {
        await context.markStockDone(movements[0].id);
      }
    }

    // 3. Update invoice status to POSTED
    const updatedInvoice = await this.invoiceRepository.update(
      input.invoiceId,
      { status: InvoiceStatus.POSTED },
      tx
    );

    if (!updatedInvoice.invoiceNumber) {
      throw new Error(
        `Invoice ${input.invoiceId} has no invoice number`
      );
    }

    // 4. Create journal entry (Revenue + AR)
    const journal = await this.journalService.postInvoice(
      input.companyId,
      input.invoiceId,
      updatedInvoice.invoiceNumber,
      Number(updatedInvoice.amount),
      Number(updatedInvoice.subtotal),
      Number(updatedInvoice.taxAmount),
      tx,
      input.businessDate // G5
    );

    await context.markJournalDone(journal.id);

    return updatedInvoice;
  }

  /**
   * Compensate on failure - reverse in reverse order
   */
  protected async compensate(context: PostingContext): Promise<void> {
    const stepData = context.stepData;

    // 1. Reverse journal (if created)
    if (stepData.journalId) {
      await this.journalService.reverse(
        context.companyId,
        stepData.journalId,
        `Saga compensation for ${context.entityId}`
      );
    }

    // 2. Restore stock (if shipped)
    if (stepData.stockMovementId) {
      // Fetch invoice with order details to get items
      const invoice = await this.invoiceRepository.findById(
        context.entityId,
        context.companyId,
        'INVOICE'
      );

      const invoiceWithOrder = invoice as Invoice & {
        order: {
          id: string;
          items: { productId: string; quantity: number }[];
        };
      };

      if (
        invoiceWithOrder &&
        invoiceWithOrder.orderId &&
        invoiceWithOrder.order
      ) {
        // Map items for return
        const returnItems = invoiceWithOrder.order.items.map(
          (item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })
        );

        // Execute return (reverses stock + COGS)
        await this.inventoryService.processReturn(
          context.companyId,
          invoiceWithOrder.orderId,
          returnItems,
          `Saga compensation for Invoice ${invoiceWithOrder.invoiceNumber}`
        );
      } else {
        console.warn(
          `[SAGA] Could not restore stock for ${context.entityId}: Order or items not found by invoice ID`
        );
      }
    }

    // 3. Revert invoice status back to DRAFT
    await this.invoiceRepository.update(context.entityId, {
      status: InvoiceStatus.DRAFT,
    });
  }
}
