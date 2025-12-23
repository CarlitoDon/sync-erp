import {
  Invoice,
  InvoiceStatus,
  InvoiceType,
  OrderType,
  OrderStatus,
  PaymentStatus,
  PaymentTerms,
  Prisma,
  AuditLogAction,
  EntityType,
  prisma,
} from '@sync-erp/database';
import { InvoiceRepository } from '../repositories/invoice.repository';
import {
  BusinessDate,
  DomainError,
  DomainErrorCodes,
  Money,
} from '@sync-erp/shared';
import { JournalService } from './journal.service';

export interface CreateBillInput {
  orderId: string;
  supplierInvoiceNumber?: string; // External reference from supplier's invoice
  dueDate?: Date;
  taxRate?: number;
  businessDate?: Date;
  paymentTermsString?: string;
} // G5

import { DocumentNumberService } from '../../common/services/document-number.service';
import { BillPolicy } from '../policies/bill.policy';
import { InventoryRepository } from '../../inventory/inventory.repository.js';
import * as auditLogService from '../../common/audit/audit-log.service';

export class BillService {
  private repository = new InvoiceRepository();
  private inventoryRepository = new InventoryRepository();
  private documentNumberService = new DocumentNumberService();
  private journalService = new JournalService();

  async createFromPurchaseOrder(
    companyId: string,
    data: CreateBillInput
  ): Promise<Invoice> {
    const order = await this.repository.findOrder(
      data.orderId,
      companyId,
      OrderType.PURCHASE
    );

    BillPolicy.validateCreate(data);

    if (!order) {
      throw new DomainError(
        'Purchase order not found',
        404,
        DomainErrorCodes.ORDER_NOT_FOUND
      );
    }

    // FR-001: Validate PO status - must be CONFIRMED or later
    BillPolicy.ensureOrderReadyForBill(order);

    // FR-001: Validate GRN exists - goods must be received first
    const grnCount =
      await this.inventoryRepository.countByReferencePatterns(
        companyId,
        [data.orderId, order.orderNumber].filter(
          (p): p is string => !!p
        ),
        'IN'
      );
    // Note: passing undefined for tx implicitly as it's optional last arg
    BillPolicy.ensureGoodsReceived(grnCount);

    // Always auto-generate internal Bill number
    const invoiceNumber = await this.documentNumberService.generate(
      companyId,
      'BILL'
    );

    // Calculate subtotal from items (Net) avoiding double tax from order.totalAmount (Gross)
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

    // Create lines from order items
    // Assuming Invoice has 'items' relation to InvoiceLine/BillLine
    const createData: Prisma.InvoiceUncheckedCreateInput = {
      companyId,
      orderId: data.orderId,
      partnerId: order.partnerId,
      type: InvoiceType.BILL,
      status: InvoiceStatus.DRAFT,
      invoiceNumber,
      supplierInvoiceNumber: data.supplierInvoiceNumber, // External reference from supplier
      amount,
      subtotal,
      taxAmount,
      taxRate,
      balance: amount,
      dueDate:
        data.dueDate ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      paymentTermsString:
        order.paymentTerms || data.paymentTermsString || 'NET30', // Inherit from PO if exists
    };

    return this.repository.create(createData);
  }

  /**
   * Create a Down Payment Bill for UPFRONT Payment Terms.
   * Called automatically when confirming a PO with UPFRONT terms.
   * NOTE: This SKIPS the GRN requirement since payment is needed BEFORE delivery.
   */
  async createDownPaymentBill(
    companyId: string,
    orderId: string
  ): Promise<Invoice> {
    const order = await this.repository.findOrder(
      orderId,
      companyId,
      OrderType.PURCHASE
    );

    if (!order) {
      throw new DomainError(
        'Purchase order not found',
        404,
        DomainErrorCodes.ORDER_NOT_FOUND
      );
    }

    // Must be CONFIRMED for DP Bill
    if (order.status !== OrderStatus.CONFIRMED) {
      throw new DomainError(
        `Cannot create DP Bill: PO status is ${order.status}, must be CONFIRMED`,
        400,
        DomainErrorCodes.ORDER_INVALID_STATE
      );
    }

    // Must be UPFRONT terms
    if (order.paymentTerms !== PaymentTerms.UPFRONT) {
      throw new DomainError(
        'DP Bill can only be created for UPFRONT payment terms',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }

    // Check if DP Bill already exists for this PO
    const existingBill = await this.repository.findByOrderId(
      orderId,
      companyId
    );
    if (existingBill) {
      // Already exists, return it (idempotent)
      return existingBill;
    }

    // Generate bill number
    const invoiceNumber = await this.documentNumberService.generate(
      companyId,
      'BILL'
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
      type: InvoiceType.BILL,
      status: InvoiceStatus.DRAFT,
      invoiceNumber,
      notes: `Down Payment Bill for PO ${order.orderNumber || orderId}`,
      amount,
      subtotal,
      taxAmount,
      taxRate,
      balance: amount,
      dueDate: new Date(), // Immediate payment required for UPFRONT
      paymentTermsString: 'UPFRONT',
    };

    return this.repository.create(createData);
  }

  async getById(id: string, companyId: string) {
    return this.repository.findById(id, companyId, InvoiceType.BILL);
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
      InvoiceType.BILL,
      validatedStatus
    );
  }

  /**
   * Post bill atomically using Prisma transaction.
   * All operations (status update + journal entry) are atomic - auto-rollback on error.
   */
  async post(
    id: string,
    companyId: string,
    businessDate?: Date,
    actorId?: string, // FR-010.1: Actor for audit log
    correlationId?: string // FR-010.1: Request tracing
  ): Promise<Invoice> {
    if (businessDate) {
      BusinessDate.from(businessDate).ensureValid();
      BusinessDate.from(businessDate).ensureNotBackdated();
    }

    // FR-010.1: Record Audit Log BEFORE transaction
    if (actorId) {
      await auditLogService.recordAudit({
        companyId,
        actorId,
        action: AuditLogAction.BILL_POSTED,
        entityType: EntityType.BILL,
        entityId: id,
        businessDate: businessDate || new Date(),
        correlationId,
      });
    }

    return prisma.$transaction(
      async (tx) => {
        // 1. Lock row for concurrency safety
        await tx.$executeRaw`SELECT 1 FROM "Invoice" WHERE id = ${id} FOR UPDATE`;

        // 2. Validate bill exists and is DRAFT
        const bill = await this.repository.findById(
          id,
          companyId,
          InvoiceType.BILL,
          tx
        );
        if (!bill) {
          throw new DomainError(
            'Bill not found',
            404,
            DomainErrorCodes.BILL_NOT_FOUND
          );
        }

        BillPolicy.validatePost(bill.status);

        // Phase 1 Guard: Block Multi-Currency
        const currency =
          (bill as Invoice & { currency?: string }).currency || 'IDR';
        Money.from(0, currency).ensureBase();

        // 3. Update status to POSTED
        const updatedBill = await this.repository.update(
          id,
          { status: InvoiceStatus.POSTED },
          tx
        );

        if (!updatedBill.invoiceNumber) {
          throw new Error(`Bill ${id} has no bill number`);
        }

        // 4. Create AP journal entry
        await this.journalService.postBill(
          companyId,
          id,
          updatedBill.invoiceNumber,
          Number(updatedBill.amount),
          Number(updatedBill.subtotal),
          Number(updatedBill.taxAmount),
          tx,
          businessDate
        );

        // 5. Feature 036: Auto-settle prepaid for upfront POs
        if (updatedBill.orderId) {
          const order = await tx.order.findUnique({
            where: { id: updatedBill.orderId },
            include: {
              upfrontPayments: {
                where: {
                  paymentType: 'UPFRONT',
                  settledAt: null, // Only unsettled payments
                },
              },
            },
          });

          if (
            order &&
            order.paymentTerms === PaymentTerms.UPFRONT &&
            order.upfrontPayments.length > 0
          ) {
            // Calculate total unsettled prepaid
            const prepaidAmount = order.upfrontPayments.reduce(
              (sum, p) => sum + Number(p.amount),
              0
            );
            const billBalance = Number(updatedBill.balance);
            const settlementAmount = Math.min(
              prepaidAmount,
              billBalance
            );

            if (settlementAmount > 0) {
              // Create settlement journal: Dr 2100 AP, Cr 1600 Advances
              const firstPayment = order.upfrontPayments[0];
              await this.journalService.postSettlePrepaid(
                companyId,
                firstPayment.id,
                updatedBill.invoiceNumber,
                settlementAmount,
                tx
              );

              // Update Bill balance
              const newBalance = billBalance - settlementAmount;
              await tx.invoice.update({
                where: { id },
                data: {
                  balance: newBalance,
                  status:
                    newBalance <= 0
                      ? InvoiceStatus.PAID
                      : InvoiceStatus.POSTED,
                },
              });

              // Mark Payment(s) as settled
              await tx.payment.updateMany({
                where: {
                  id: { in: order.upfrontPayments.map((p) => p.id) },
                },
                data: {
                  settledAt: new Date(),
                  settlementBillId: id,
                },
              });

              // Update Order paymentStatus to SETTLED
              await tx.order.update({
                where: { id: order.id },
                data: {
                  paymentStatus: PaymentStatus.SETTLED,
                },
              });
            }
          }

          // Update PO to COMPLETED if it's already RECEIVED
          await tx.order.updateMany({
            where: {
              id: updatedBill.orderId,
              companyId,
              status: OrderStatus.RECEIVED,
            },
            data: {
              status: OrderStatus.COMPLETED,
            },
          });
        }

        return (await this.repository.findById(
          id,
          companyId,
          InvoiceType.BILL,
          tx
        ))!;
      },
      { timeout: 60000 }
    );
  }

  /**
   * Void a Bill atomically using Prisma transaction.
   * Policy: Cannot void if payments exist. If POSTED, reverse AP journal.
   */
  async void(id: string, companyId: string): Promise<Invoice> {
    return prisma.$transaction(
      async (tx) => {
        // 1. Lock row for concurrency safety
        await tx.$executeRaw`SELECT 1 FROM "Invoice" WHERE id = ${id} FOR UPDATE`;

        // 2. Validate bill exists
        const bill = await this.repository.findById(
          id,
          companyId,
          InvoiceType.BILL,
          tx
        );
        if (!bill) {
          throw new DomainError(
            'Bill not found',
            404,
            DomainErrorCodes.BILL_NOT_FOUND
          );
        }

        // 3. Cannot void if already VOID
        if (bill.status === InvoiceStatus.VOID) {
          throw new DomainError(
            'Bill is already voided',
            422,
            DomainErrorCodes.BILL_INVALID_STATE
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
            'Cannot void bill: Payments have been recorded. Void the payments first.',
            422,
            DomainErrorCodes.BILL_HAS_PAYMENTS
          );
        }

        // 5. If POSTED, reverse the AP journal entry
        if (bill.status === InvoiceStatus.POSTED) {
          await this.journalService.postBillReversal(
            companyId,
            bill.id,
            bill.invoiceNumber || '',
            Number(bill.amount),
            Number(bill.subtotal) || undefined,
            Number(bill.taxAmount) || undefined,
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
      InvoiceType.BILL,
      InvoiceStatus.POSTED
    );
  }

  async getRemainingAmount(
    id: string,
    companyId: string
  ): Promise<number> {
    const bill = await this.repository.findById(id, companyId);
    if (!bill) throw new Error('Bill not found');
    return Number(bill.balance);
  }

  async getByOrderId(orderId: string, companyId: string) {
    return this.repository.findByOrderId(
      orderId,
      companyId,
      InvoiceType.BILL
    );
  }
}
