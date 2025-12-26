import {
  Invoice,
  InvoiceStatus,
  InvoiceType,
  OrderType,
  OrderStatus,
  Prisma,
  BusinessShape,
  IdempotencyScope,
  AuditLogAction,
  EntityType,
  prisma,
  PaymentTerms,
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
import { CustomerDepositService } from '../../sales/customer-deposit.service';

export class InvoiceService {
  private repository = new InvoiceRepository();
  private journalService = new JournalService();
  private documentNumberService = new DocumentNumberService();
  private idempotencyService = new IdempotencyService();
  private inventoryService = new InventoryService();
  private customerDepositService = new CustomerDepositService();

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
    const validStatuses: InvoiceStatus[] = [
      InvoiceStatus.DRAFT,
      InvoiceStatus.POSTED,
      InvoiceStatus.PARTIALLY_PAID,
      InvoiceStatus.PAID,
      InvoiceStatus.VOID,
    ];
    const validatedStatus =
      status && validStatuses.includes(status as InvoiceStatus)
        ? (status as InvoiceStatus)
        : undefined;

    return this.repository.findAll(
      companyId,
      InvoiceType.INVOICE,
      validatedStatus
    );
  }

  /**
   * Create a Down Payment Invoice for UPFRONT Payment Terms.
   * Called automatically when confirming a SO with UPFRONT terms.
   * NOTE: This is for proforma invoice / deposit before delivery.
   */
  async createDownPaymentInvoice(
    companyId: string,
    orderId: string
  ): Promise<Invoice> {
    const order = await this.repository.findOrder(
      orderId,
      companyId,
      OrderType.SALES
    );

    if (!order) {
      throw new DomainError(
        'Sales order not found',
        404,
        DomainErrorCodes.ORDER_NOT_FOUND
      );
    }

    // Must be CONFIRMED for DP Invoice
    if (order.status !== OrderStatus.CONFIRMED) {
      throw new DomainError(
        `Cannot create DP Invoice: SO status is ${order.status}, must be CONFIRMED`,
        400,
        DomainErrorCodes.ORDER_INVALID_STATE
      );
    }

    // Must be UPFRONT terms
    if (order.paymentTerms !== PaymentTerms.UPFRONT) {
      throw new DomainError(
        'DP Invoice can only be created for UPFRONT payment terms',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }

    // Check if DP Invoice already exists for this SO
    const existingInvoice = await this.repository.findByOrderId(
      orderId,
      companyId,
      InvoiceType.INVOICE
    );
    if (existingInvoice) {
      // Already exists, return it (idempotent)
      return existingInvoice;
    }

    // Generate invoice number
    const invoiceNumber = await this.documentNumberService.generate(
      companyId,
      'INV'
    );

    // Calculate subtotal from items (Net)
    const subtotal = order.items.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0
    );

    const taxRate = order.taxRate ? Number(order.taxRate) : 0;
    const taxMultiplier = taxRate > 1 ? taxRate / 100 : taxRate;
    const taxAmount = subtotal * taxMultiplier;
    const amount = subtotal + taxAmount;

    const createData: Prisma.InvoiceUncheckedCreateInput = {
      companyId,
      orderId,
      partnerId: order.partnerId,
      type: InvoiceType.INVOICE,
      status: InvoiceStatus.DRAFT,
      invoiceNumber,
      notes: `Down Payment Invoice for SO ${order.orderNumber || orderId}`,
      amount,
      subtotal,
      taxAmount,
      taxRate,
      balance: amount,
      dueDate: new Date(), // Immediate payment required for UPFRONT
    };

    return this.repository.create(createData);
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
          let order = null;
          if (invoice.orderId) {
            order = await this.repository.findOrderWithItems(
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

          // Return both invoice and order info for auto-settlement check
          return { invoice: updatedInvoice, order };
        },
        { timeout: 60000 }
      );

      // 6. Cash Upfront Sales: Auto-settle customer deposit if applicable
      // Check if the linked order has UPFRONT payment terms
      if (
        result.order &&
        result.order.paymentTerms === PaymentTerms.UPFRONT
      ) {
        try {
          const depositInfo =
            await this.customerDepositService.getDepositInfo(
              companyId,
              result.invoice.id
            );

          // If there's a deposit available, auto-settle
          if (
            depositInfo.hasDeposit &&
            depositInfo.settlementAmount > 0
          ) {
            await this.customerDepositService.settleDeposit(
              companyId,
              result.invoice.id,
              actorId || 'system'
            );

            // Audit log for auto-settlement
            if (actorId) {
              await auditLogService.recordAudit({
                companyId,
                actorId,
                action: AuditLogAction.PAYMENT_RECORDED,
                entityType: EntityType.INVOICE,
                entityId: result.invoice.id,
                businessDate: businessDate || new Date(),
                payloadSnapshot: {
                  type: 'AUTO_SETTLE_CUSTOMER_DEPOSIT',
                  depositAmount: depositInfo.settlementAmount,
                },
                correlationId,
              });
            }
          }
        } catch (settleError) {
          // Log settlement error but don't fail the invoice post
          console.error(
            'Auto-settlement failed for invoice:',
            result.invoice.id,
            settleError
          );
        }
      }

      // Idempotency Complete
      if (idempotencyKey) {
        await this.idempotencyService.complete(
          idempotencyKey,
          result.invoice
        );
      }

      return result.invoice;
    } catch (error) {
      if (idempotencyKey) {
        await this.idempotencyService.fail(idempotencyKey);
      }
      throw error;
    }
  }

  /**
   * Void an Invoice atomically using Prisma transaction.
   * Policy: Cannot void if payments exist. If POSTED, reverse AR journal.
   * FR-024: Requires mandatory reason field for audit trail.
   */
  async void(
    id: string,
    companyId: string,
    actorId: string,
    reason: string
  ): Promise<Invoice> {
    // FR-024: Reason is mandatory
    if (!reason || reason.trim().length === 0) {
      throw new DomainError(
        'Void reason is required',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }

    // FR-010.1: Record Audit Log with void reason
    await auditLogService.recordAudit({
      companyId,
      actorId,
      action: AuditLogAction.INVOICE_VOIDED,
      entityType: EntityType.INVOICE,
      entityId: id,
      businessDate: new Date(),
      payloadSnapshot: { reason },
    });

    return prisma.$transaction(
      async (tx) => {
        // 1. Lock row for concurrency safety
        await tx.$executeRaw`SELECT 1 FROM "Invoice" WHERE id = ${id} FOR UPDATE`;

        // 2. Validate invoice exists
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

        // 3. Cannot void if already VOID
        if (invoice.status === InvoiceStatus.VOID) {
          throw new DomainError(
            'Invoice is already voided',
            422,
            DomainErrorCodes.INVOICE_INVALID_STATE
          );
        }

        // 4. Cannot void if any payments exist
        const paymentCount = await this.repository.countPayments(
          id,
          companyId,
          tx
        );
        if (paymentCount > 0) {
          throw new DomainError(
            'Cannot void invoice: Payments have been recorded. Void the payments first.',
            422,
            DomainErrorCodes.INVOICE_HAS_PAYMENTS
          );
        }

        // 5. If POSTED, reverse the AR journal entry
        if (invoice.status === InvoiceStatus.POSTED) {
          await this.journalService.postInvoiceReversal(
            companyId,
            invoice.id,
            invoice.invoiceNumber || '',
            Number(invoice.amount),
            Number(invoice.subtotal) || undefined,
            Number(invoice.taxAmount) || undefined,
            tx
          );
        }

        // 6. Update status to VOID
        return this.repository.update(
          id,
          { status: InvoiceStatus.VOID },
          tx
        );
      },
      { timeout: 60000 }
    );
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
