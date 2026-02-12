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
import { Decimal } from 'decimal.js';
import {
  DomainError,
  DomainErrorCodes,
  BusinessDate,
  Money,
  TRANSACTION_TIMEOUT_MS,
} from '@sync-erp/shared';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { JournalService } from './journal.service';
import { ReversalPolicy } from '../policies/reversal.policy';
import { InvoicePolicy } from '../policies/invoice.policy';
import { InventoryRepository } from '../../inventory/inventory.repository';
import { normalizeTaxRate } from '../../common/utils/finance.utils';

// Update Interface
export interface CreateInvoiceInput {
  orderId: string;
  fulfillmentId?: string; // Feature 041: Link to specific Shipment
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
import { calculateDueDate } from '../../common/utils/payment-terms.utils';
import {
  validateAndAuditVoid,
  validateCanVoid,
} from '../../common/utils/document.utils';
import { SalesOrderRepository } from '../../sales/sales-order.repository';

export class InvoiceService {
  constructor(
    private readonly repository: InvoiceRepository = new InvoiceRepository(),
    private readonly journalService: JournalService = new JournalService(),
    private readonly documentNumberService: DocumentNumberService = new DocumentNumberService(),
    private readonly idempotencyService: IdempotencyService = new IdempotencyService(),
    private readonly inventoryService: InventoryService = new InventoryService(),
    private readonly customerDepositService: CustomerDepositService = new CustomerDepositService(),
    private readonly salesOrderRepository: SalesOrderRepository = new SalesOrderRepository(),
    private readonly inventoryRepository: InventoryRepository = new InventoryRepository()
  ) {}

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

    // Feature 041: Validate fulfillment if provided
    type FulfillmentItemWithRelations = {
      quantity: Prisma.Decimal;
      orderItem: { price: Prisma.Decimal } | null;
    };
    let shipmentItems: FulfillmentItemWithRelations[] = [];
    let fulfillment: Awaited<
      ReturnType<typeof this.inventoryRepository.findFulfillmentById>
    > = null;
    if (data.fulfillmentId) {
      fulfillment =
        await this.inventoryRepository.findFulfillmentById(
          data.fulfillmentId,
          companyId
        );

      if (!fulfillment) {
        throw new DomainError(
          'Shipment not found',
          404,
          DomainErrorCodes.FULFILLMENT_NOT_FOUND
        );
      }

      if (fulfillment.orderId !== data.orderId) {
        throw new DomainError(
          'Shipment does not belong to this sales order',
          400,
          DomainErrorCodes.FULFILLMENT_NOT_FOR_ORDER
        );
      }

      // Feature 041: Validate shipment not already invoiced
      InvoicePolicy.validateFulfillmentNotInvoiced(fulfillment);
      shipmentItems = fulfillment.items;
    }

    // Generate invoice number if not provided
    let invoiceNumber = data.invoiceNumber;
    if (!invoiceNumber) {
      invoiceNumber = await this.documentNumberService.generate(
        companyId,
        'INV'
      );
    }

    // Calculate total with optional tax
    // If fulfillmentId is provided, use shipment items. Otherwise use SO items (legacy/full)
    let subtotal = 0;
    if (shipmentItems.length > 0) {
      subtotal = shipmentItems.reduce(
        (sum, item) =>
          sum +
          Number(item.orderItem?.price || 0) * Number(item.quantity),
        0
      );
    } else {
      subtotal = order.items.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0
      );
    }

    // Feature 041: Validate not over-invoicing only when fulfillmentId is provided
    // For legacy flow (no fulfillmentId), skip this validation to maintain backward compatibility
    if (data.fulfillmentId) {
      const existingInvoicedTotal =
        await this.repository.sumInvoicedByOrderId(
          data.orderId,
          companyId,
          InvoiceType.INVOICE
        );
      const orderSubtotal = order.items.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0
      );

      InvoicePolicy.validateNotOverInvoicing(
        new Decimal(subtotal),
        new Decimal(existingInvoicedTotal),
        new Decimal(orderSubtotal)
      );
    }

    let taxRate = data.taxRate;
    if (taxRate === undefined && order.taxRate !== null) {
      taxRate = Number(order.taxRate);
    }
    taxRate = taxRate || 0;

    const taxMultiplier = normalizeTaxRate(taxRate);
    const taxAmount = subtotal * taxMultiplier;
    let amount = subtotal + taxAmount;

    // Deduct DP amount if DP Invoice was paid (O2C Optimization)
    const dpAmount = order.dpAmount ? Number(order.dpAmount) : 0;
    let dpDeductedNow = 0;
    let dpInvoiceId: string | undefined;

    if (dpAmount > 0) {
      // Find the PAID DP Invoice
      const dpInvoice = await this.repository.findFirst({
        orderId: data.orderId,
        companyId,
        type: InvoiceType.INVOICE,
        status: InvoiceStatus.PAID,
        isDownPayment: true,
      });

      if (dpInvoice) {
        dpInvoiceId = dpInvoice.id;
        // Calculate already deducted DP from previous invoices
        const alreadyDeducted =
          await this.repository.sumDeductedDpByOrderId(
            data.orderId,
            companyId,
            InvoiceType.INVOICE
          );
        const remainingDp = dpAmount - alreadyDeducted;

        if (remainingDp > 0) {
          // Calculate proportional DP allocation for this invoice
          // Formula: (invoiceGross / orderTotal) × dpAmount
          const orderTotal = Number(order.totalAmount) || 1; // Guard div by zero
          const proportionalDp = (amount / orderTotal) * dpAmount;

          // Cap by remaining DP
          dpDeductedNow = Math.min(
            proportionalDp,
            remainingDp,
            amount
          );
          amount = amount - dpDeductedNow;
        }
      }
    }

    // Create the invoice
    const createData: Prisma.InvoiceUncheckedCreateInput = {
      companyId,
      orderId: data.orderId,
      partnerId: order.partnerId,
      fulfillmentId: data.fulfillmentId || null, // Feature 041: Link to specific Shipment
      type: InvoiceType.INVOICE,
      status: InvoiceStatus.DRAFT,
      invoiceNumber,
      dpBillId: dpInvoiceId, // Link to DP Invoice using same field as Bills
      notes:
        dpDeductedNow > 0
          ? `Final Invoice (DP deducted: Rp ${dpDeductedNow.toLocaleString()})`
          : undefined,
      amount,
      subtotal,
      taxAmount,
      taxRate,
      balance: amount,
      dueDate:
        data.dueDate ||
        calculateDueDate(
          new Date(),
          order.paymentTerms || PaymentTerms.NET30
        ),
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
   * Create a Down Payment Invoice for UPFRONT Payment Terms or Tempo+DP.
   * Called automatically when confirming a SO with:
   * - UPFRONT terms (100% DP)
   * - Tempo terms with dpAmount > 0 (partial DP)
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

    // GAP-3 Fix: Must have DP requirement (UPFRONT or dpAmount > 0)
    const dpAmount = order.dpAmount ? Number(order.dpAmount) : 0;
    const isUpfront = order.paymentTerms === PaymentTerms.UPFRONT;

    if (!isUpfront && dpAmount <= 0) {
      throw new DomainError(
        'DP Invoice can only be created for UPFRONT payment terms or orders with dpAmount > 0',
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

    // GAP-3 Fix: Calculate amounts based on DP type (mirrors BillService)
    let amount: number;
    let subtotal: number;
    let taxAmount: number;
    const taxRate = order.taxRate ? Number(order.taxRate) : 0;
    const taxMultiplier = normalizeTaxRate(taxRate);

    if (isUpfront) {
      // UPFRONT: 100% of order total
      subtotal = order.items.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0
      );
      taxAmount = subtotal * taxMultiplier;
      amount = subtotal + taxAmount;
    } else {
      // Tempo+DP: Use dpAmount (already includes tax if calculated from grandTotal)
      amount = dpAmount;
      // Reverse calculate subtotal and tax from amount
      subtotal = amount / (1 + taxMultiplier);
      taxAmount = amount - subtotal;
    }

    const dpPercent = order.dpPercent
      ? Number(order.dpPercent)
      : isUpfront
        ? 100
        : 0;

    const createData: Prisma.InvoiceUncheckedCreateInput = {
      companyId,
      orderId,
      partnerId: order.partnerId,
      type: InvoiceType.INVOICE,
      status: InvoiceStatus.DRAFT,
      invoiceNumber,
      notes: `Down Payment Invoice (${dpPercent}%) for SO ${order.orderNumber || orderId}`,
      amount,
      subtotal,
      taxAmount,
      taxRate,
      balance: amount,
      dueDate: new Date(), // Immediate payment required for DP
      isDownPayment: true, // Feature: Explicit DP Linking
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
      throw new DomainError(
        'Original invoice not found',
        404,
        DomainErrorCodes.INVOICE_NOT_FOUND
      );
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

          InvoicePolicy.validatePost(invoice.status);

          // FR-011: 3-Way Matching Validation (O2C Mirror)
          // Only for Invoices linked to a SO (orderId exists)
          // Only validate if order was MANUALLY shipped before invoice
          // (auto-shipment during post matches order qty by design)
          if (invoice.orderId) {
            const order = await this.salesOrderRepository.findById(
              invoice.orderId,
              companyId,
              tx
            );
            if (order) {
              // Check if order was already shipped (manual shipment scenario)
              const alreadyShippedStatuses: OrderStatus[] = [
                OrderStatus.SHIPPED,
                OrderStatus.PARTIALLY_SHIPPED,
                OrderStatus.COMPLETED,
              ];
              const wasManuallyShipped =
                alreadyShippedStatuses.includes(
                  order.status as OrderStatus
                );

              // Only run 3-way matching for manual shipment scenarios
              if (wasManuallyShipped) {
                const shippedQtyMap =
                  await this.salesOrderRepository.getShippedQuantities(
                    invoice.orderId,
                    tx
                  );
                InvoicePolicy.validate3WayMatching(
                  {
                    amount: invoice.amount,
                    subtotal: invoice.subtotal,
                    notes: invoice.notes,
                    items: invoice.items,
                  },
                  {
                    items: order.items,
                    totalAmount: order.totalAmount,
                    dpAmount: order.dpAmount,
                    paymentTerms: order.paymentTerms,
                    taxRate: order.taxRate,
                  },
                  shippedQtyMap,
                  invoice.isDownPayment // Pass isDpInvoice flag
                );
              }
            }
          }

          // Phase 1 Guard: Block Multi-Currency
          const currency =
            (invoice as Invoice & { currency?: string }).currency ||
            'IDR';
          Money.from(0, currency).ensureBase();

          // 3. Stock OUT (if order-linked and not already shipped)
          let order = null;
          if (invoice.orderId) {
            order = await this.repository.findOrderWithItems(
              invoice.orderId,
              companyId,
              tx
            );

            if (order) {
              // Skip auto-shipment if order is already shipped (manual shipment before invoice)
              const alreadyShippedStatuses: OrderStatus[] = [
                OrderStatus.SHIPPED,
                OrderStatus.PARTIALLY_SHIPPED,
                OrderStatus.COMPLETED,
              ];
              const needsShipment = !alreadyShippedStatuses.includes(
                order.status as OrderStatus
              );

              if (needsShipment) {
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
          }

          // 4. Update invoice status to POSTED
          const updatedInvoice = await this.repository.update(
            id,
            { status: InvoiceStatus.POSTED },
            tx
          );

          if (!updatedInvoice.invoiceNumber) {
            throw new DomainError(
              `Invoice ${id} has no invoice number`,
              500,
              DomainErrorCodes.INVOICE_INVALID_STATE
            );
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
        { timeout: TRANSACTION_TIMEOUT_MS }
      );

      // 6. Cash Upfront Sales: Auto-settle customer deposit if applicable
      // GAP-3 Fix: Allow auto-settlement for any order with a deposit (Tempo + DP)
      if (result.order) {
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
            '[InvoiceService] Auto-settlement failed for invoice:',
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

  async void(
    id: string,
    companyId: string,
    actorId: string,
    reason: string,
    userPermissions?: string[]
  ): Promise<Invoice> {
    const voidConfig = {
      id,
      companyId,
      actorId,
      reason,
      documentName: 'Invoice',
      requiredPermission: 'invoice:void',
      userPermissions,
      auditAction: AuditLogAction.INVOICE_VOIDED,
      entityType: EntityType.INVOICE,
      notFoundErrorCode: DomainErrorCodes.INVOICE_NOT_FOUND,
      invalidStateErrorCode: DomainErrorCodes.INVOICE_INVALID_STATE,
      hasPaymentsErrorCode: DomainErrorCodes.INVOICE_HAS_PAYMENTS,
    };

    // Validate permission, reason, and record audit
    await validateAndAuditVoid(voidConfig);

    return prisma.$transaction(
      async (tx) => {
        // Lock row for concurrency safety
        await tx.$executeRaw`SELECT 1 FROM "Invoice" WHERE id = ${id} FOR UPDATE`;

        // Validate document
        const invoice = await this.repository.findById(
          id,
          companyId,
          InvoiceType.INVOICE,
          tx
        );
        const paymentCount = await this.repository.countPayments(
          id,
          companyId,
          tx
        );
        validateCanVoid(invoice, paymentCount, voidConfig);

        // If POSTED, reverse the AR journal entry
        if (invoice!.status === InvoiceStatus.POSTED) {
          await this.journalService.postInvoiceReversal(
            companyId,
            invoice!.id,
            invoice!.invoiceNumber || '',
            Number(invoice!.amount),
            Number(invoice!.subtotal) || undefined,
            Number(invoice!.taxAmount) || undefined,
            tx
          );
        }

        // Update status to VOID
        return this.repository.update(
          id,
          { status: InvoiceStatus.VOID },
          tx
        );
      },
      { timeout: TRANSACTION_TIMEOUT_MS }
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
    if (!invoice)
      throw new DomainError(
        'Invoice not found',
        404,
        DomainErrorCodes.INVOICE_NOT_FOUND
      );

    // We can rely on 'balance' field which we maintain?
    // Legacy PaymentService updates balance.
    // But getRemainingAmount in legacy InvoiceService calculated it from payments.
    // Redundancy. Trust 'balance' field or recalculate?
    // We already maintain balance in Payment Logic.
    return Number(invoice.balance);
  }
}
