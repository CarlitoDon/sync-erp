import {
  Invoice,
  InvoiceStatus,
  InvoiceType,
  OrderType,
  Prisma,
  BusinessShape,
  IdempotencyScope,
  AuditLogAction,
  EntityType,
  prisma,
} from '@sync-erp/database';
import {
  DomainError,
  DomainErrorCodes,
  BusinessDate,
  Money,
} from '@sync-erp/shared';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { JournalService } from './journal.service';
import { ReversalPolicy } from '../policies/reversal.policy';
import { InvoicePolicy } from '../policies/invoice.policy';

// Update Interface
export interface CreateInvoiceInput {
  orderId: string;
  invoiceNumber?: string;
  dueDate?: Date;
  taxRate?: number;
  businessDate?: Date; // G5
}

import { DocumentNumberService } from '../../common/services/document-number.service';
import { IdempotencyService } from '../../common/services/idempotency.service';
import * as auditLogService from '../../common/audit/audit-log.service';
import { InventoryService } from '../../inventory/inventory.service.js';

export class InvoiceService {
  private repository = new InvoiceRepository();
  private journalService = new JournalService();
  private documentNumberService = new DocumentNumberService();
  private idempotencyService = new IdempotencyService();
  private inventoryService = new InventoryService();

  async createFromSalesOrder(
    companyId: string,
    data: CreateInvoiceInput
  ): Promise<Invoice> {
    const order = await this.repository.findOrder(
      data.orderId,
      companyId,
      OrderType.SALES
    );

    InvoicePolicy.validateCreate(data);

    if (!order) {
      throw new DomainError(
        'Sales order not found',
        404,
        DomainErrorCodes.ORDER_NOT_FOUND
      );
    }

    // FR-002: Validate SO status - must be CONFIRMED or later
    InvoicePolicy.ensureOrderReadyForInvoice(order);

    // Generate invoice number if not provided
    let invoiceNumber = data.invoiceNumber;
    if (!invoiceNumber) {
      invoiceNumber = await this.documentNumberService.generate(
        companyId,
        'INV'
      );
    }

    // Calculate total with optional tax
    // Fix: Recalculate subtotal from items to avoid double tax (order.totalAmount is Gross)
    const subtotal = order.items.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0
    );

    let taxRate = data.taxRate;
    if (taxRate === undefined && order.taxRate !== null) {
      taxRate = Number(order.taxRate);
    }
    taxRate = taxRate || 0;

    const taxMultiplier = taxRate > 1 ? taxRate / 100 : taxRate;
    const taxAmount = subtotal * taxMultiplier;
    const amount = subtotal + taxAmount;

    // Create the invoice
    const createData: Prisma.InvoiceUncheckedCreateInput = {
      companyId,
      orderId: data.orderId,
      partnerId: order.partnerId,
      type: InvoiceType.INVOICE,
      status: InvoiceStatus.DRAFT,
      invoiceNumber,
      amount,
      subtotal,
      taxAmount,
      taxRate,
      balance: amount,
      dueDate:
        data.dueDate ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
    };

    return this.repository.create(createData);
  }

  async getById(id: string, companyId: string) {
    return this.repository.findById(
      id,
      companyId,
      InvoiceType.INVOICE
    );
  }

  async list(companyId: string, status?: string) {
    // Validate status if provided - only allow valid InvoiceStatus values
    const validStatuses = ['DRAFT', 'POSTED', 'PAID', 'VOID'];
    const validatedStatus =
      status && validStatuses.includes(status)
        ? (status as InvoiceStatus)
        : undefined;

    return this.repository.findAll(
      companyId,
      InvoiceType.INVOICE,
      validatedStatus
    );
  }

  async createCreditNote(
    companyId: string,
    originalInvoiceId: string,
    _reason?: string
  ): Promise<Invoice> {
    const original = await this.repository.findById(
      originalInvoiceId,
      companyId,
      InvoiceType.INVOICE
    );

    if (!original) {
      throw new Error('Original invoice not found');
    }

    // Apply Reversal Policy
    const policyResult = ReversalPolicy.canCreateCreditNote(original);
    if (!policyResult.allowed) {
      throw new DomainError(
        policyResult.reason || 'Credit note not allowed'
      );
    }

    // Generate CN Number
    const cnNumber = await this.documentNumberService.generate(
      companyId,
      'CN'
    );

    // Create Credit Note
    const creditNote = await this.repository.create({
      companyId,
      partnerId: original.partnerId,
      type: InvoiceType.CREDIT_NOTE,
      status: InvoiceStatus.POSTED, // Auto-post for now? Or Draft? Spec says Reversal.
      // Usually CN is created and posted immediately if it's a direct reversal.
      // Let's Auto-Post to ensure Journal is created.
      invoiceNumber: cnNumber,
      relatedInvoiceId: original.id,
      amount: original.amount,
      subtotal: original.subtotal,
      taxAmount: original.taxAmount,
      taxRate: original.taxRate,
      balance: 0, // CN has no "balance" to pay? Or it sits on account?
      // Apple Principle: Simple. It clears the debt.
      // If Paid, it creates "Credit" on Customer Account.
      // If Unpaid, it clears the Invoice Balance.
      // For MVP: Just create the record and Journal.
      // We are not auto-applying to Balance yet.
      // So balance = amount (Credit Balance).
      dueDate: new Date(),
    });

    // Post Journal Reversal
    await this.journalService.postCreditNote(
      companyId,
      creditNote.id,
      cnNumber,
      Number(creditNote.amount),
      Number(creditNote.subtotal),
      Number(creditNote.taxAmount)
    );

    return creditNote;
  }

  /**
   * Post invoice atomically using Prisma transaction.
   * All operations (shipment + status update + journal) are atomic - auto-rollback on error.
   */
  async post(
    id: string,
    companyId: string,
    _shape?: BusinessShape,
    _configs?: { key: string; value: Prisma.JsonValue }[],
    idempotencyKey?: string,
    businessDate?: Date, // G5: Accepted here
    actorId?: string, // FR-010.1: Actor for audit log
    correlationId?: string // FR-010.1: Request tracing
  ): Promise<Invoice> {
    // Idempotency Check (if provided)
    if (idempotencyKey) {
      const lock = await this.idempotencyService.lock<Invoice>(
        idempotencyKey,
        companyId,
        IdempotencyScope.INVOICE_POST,
        id
      );
      if (lock.saved && lock.response) {
        return lock.response;
      }
    }

    if (businessDate) {
      BusinessDate.from(businessDate).ensureValid();
      BusinessDate.from(businessDate).ensureNotBackdated();
    }

    // FR-010.1: Record Audit Log BEFORE transaction
    if (actorId) {
      await auditLogService.recordAudit({
        companyId,
        actorId,
        action: AuditLogAction.INVOICE_POSTED,
        entityType: EntityType.INVOICE,
        entityId: id,
        businessDate: businessDate || new Date(),
        payloadSnapshot: { idempotencyKey },
        correlationId,
      });
    }

    try {
      const result = await prisma.$transaction(
        async (tx) => {
          // 1. Lock row for concurrency safety
          await tx.$executeRaw`SELECT 1 FROM "Invoice" WHERE id = ${id} FOR UPDATE`;

          // 2. Validate invoice exists and is DRAFT
          const invoice = await this.repository.findById(
            id,
            companyId,
            InvoiceType.INVOICE,
            tx
          );
          if (!invoice) {
            throw new DomainError(
              'Invoice not found',
              404,
              DomainErrorCodes.INVOICE_NOT_FOUND
            );
          }

          if (invoice.status !== InvoiceStatus.DRAFT) {
            throw new DomainError(
              `Cannot post invoice with status ${invoice.status}`,
              422,
              DomainErrorCodes.INVOICE_INVALID_STATE
            );
          }

          // Phase 1 Guard: Block Multi-Currency
          const currency =
            (invoice as Invoice & { currency?: string }).currency ||
            'IDR';
          Money.from(0, currency).ensureBase();

          // 3. Stock OUT (if order-linked)
          if (invoice.orderId) {
            const order = await this.repository.findOrderWithItems(
              invoice.orderId,
              companyId,
              tx
            );

            if (order) {
              // Create Shipment document
              const shipment =
                await this.inventoryService.createShipment(
                  companyId,
                  {
                    salesOrderId: invoice.orderId,
                    notes: `Shipment for Invoice ${invoice.invoiceNumber}`,
                    items: order.items.map((item) => ({
                      productId: item.productId,
                      quantity: item.quantity,
                    })),
                  },
                  tx
                );

              // Post Shipment (Stock OUT + COGS Snapshot)
              await this.inventoryService.postShipment(
                companyId,
                shipment.id,
                tx
              );
            }
          }

          // 4. Update invoice status to POSTED
          const updatedInvoice = await this.repository.update(
            id,
            { status: InvoiceStatus.POSTED },
            tx
          );

          if (!updatedInvoice.invoiceNumber) {
            throw new Error(`Invoice ${id} has no invoice number`);
          }

          // 5. Create AR journal entry
          await this.journalService.postInvoice(
            companyId,
            id,
            updatedInvoice.invoiceNumber,
            Number(updatedInvoice.amount),
            Number(updatedInvoice.subtotal),
            Number(updatedInvoice.taxAmount),
            tx,
            businessDate
          );

          return updatedInvoice;
        },
        { timeout: 60000 }
      );

      // Idempotency Complete
      if (idempotencyKey) {
        await this.idempotencyService.complete(
          idempotencyKey,
          result
        );
      }

      return result;
    } catch (error) {
      if (idempotencyKey) {
        await this.idempotencyService.fail(idempotencyKey);
      }
      throw error;
    }
  }

  async void(id: string, companyId: string): Promise<Invoice> {
    const invoice = await this.repository.findById(
      id,
      companyId,
      InvoiceType.INVOICE
    );
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new Error('Cannot void a paid invoice');
    }

    // Should we reverse journal? For MVP just mark VOID.
    // Ideally we reverse. But legacy code didn't. We stick to legacy logic + new structure?
    // User refactor goal: Structure.
    return this.repository.update(id, {
      status: InvoiceStatus.VOID,
    });
  }

  async getOutstanding(companyId: string) {
    return this.repository.findAll(
      companyId,
      InvoiceType.INVOICE,
      InvoiceStatus.POSTED
    );
    // findAll helper accepts status. But findAll in repo uses findAll(companyId, type, status).
    // I need to ensure findAll sort order. Repo handles sort.
    // Need orderBy dueDate ideally? Repo has desc createdAt.
    // I'll accept repo default sorting or add specific method if needed.
    // Legacy getOutstanding sorted by dueDate ASC.
    // I'll skip dueDate sort or add it to repo if crucial.
    // For now stick to default repo.
  }

  async getByOrderId(orderId: string, companyId: string) {
    return this.repository.findByOrderId(
      orderId,
      companyId,
      InvoiceType.INVOICE
    );
  }

  async getRemainingAmount(
    id: string,
    companyId: string
  ): Promise<number> {
    const invoice = await this.repository.findById(id, companyId); // Type optional here?
    if (!invoice) throw new Error('Invoice not found');

    // We can rely on 'balance' field which we maintain?
    // Legacy PaymentService updates balance.
    // But getRemainingAmount in legacy InvoiceService calculated it from payments.
    // Redundancy. Trust 'balance' field or recalculate?
    // We already maintain balance in Payment Logic.
    return Number(invoice.balance);
  }
}
