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
  grnId?: string; // Feature: Link to specific GRN/Receipt
  supplierInvoiceNumber?: string; // External reference from supplier's invoice
  dueDate?: Date;
  taxRate?: number;
  businessDate?: Date;
  paymentTermsString?: string;
} // G5

import { DocumentNumberService } from '../../common/services/document-number.service';
import { BillPolicy } from '../policies/bill.policy';
import { InventoryRepository } from '../../inventory/inventory.repository';
import { PurchaseOrderRepository } from '../../procurement/purchase-order.repository';
import { calculateDueDate } from '../../common/utils/payment-terms.utils';
import * as auditLogService from '../../common/audit/audit-log.service';
import {
  validateAndAuditVoid,
  validateCanVoid,
} from '../../common/utils/document.utils';

export class BillService {
  constructor(
    private readonly repository: InvoiceRepository = new InvoiceRepository(),
    private readonly inventoryRepository: InventoryRepository = new InventoryRepository(),
    private readonly purchaseOrderRepository: PurchaseOrderRepository = new PurchaseOrderRepository(),
    private readonly documentNumberService: DocumentNumberService = new DocumentNumberService(),
    private readonly journalService: JournalService = new JournalService()
  ) {}

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

    // Feature: Calculate subtotal from specific GRN items if provided
    let grnItems: any[] = [];
    if (data.grnId) {
      const grn = await this.inventoryRepository.findFulfillmentById(
        data.grnId,
        companyId
      );
      if (!grn) {
        throw new DomainError(
          'Goods receipt not found',
          404,
          DomainErrorCodes.OPERATION_NOT_ALLOWED
        );
      }
      if (grn.orderId !== data.orderId) {
        throw new DomainError(
          'Goods receipt does not belong to this order',
          400,
          DomainErrorCodes.OPERATION_NOT_ALLOWED
        );
      }
      grnItems = grn.items;
    }

    // FR-013: Prevent duplicate supplier invoice numbers per supplier
    if (data.supplierInvoiceNumber) {
      const existingBill =
        await this.repository.findBySupplierInvoiceNumber(
          companyId,
          order.partnerId,
          data.supplierInvoiceNumber
        );
      if (existingBill) {
        throw new DomainError(
          `Supplier invoice number "${data.supplierInvoiceNumber}" already exists for this supplier`,
          400,
          DomainErrorCodes.DUPLICATE_SUPPLIER_INVOICE
        );
      }
    }

    // Always auto-generate internal Bill number
    const invoiceNumber = await this.documentNumberService.generate(
      companyId,
      'BILL'
    );

    // Calculate subtotal from items (Net)
    // If grnId is provided, use GRN items. Otherwise use PO items (legacy/full)
    let subtotal = 0;
    if (grnItems.length > 0) {
      subtotal = grnItems.reduce(
        (sum, item) =>
          sum + Number(item.orderItem?.price || 0) * item.quantity,
        0
      );
    } else {
      subtotal = order.items.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0
      );
    }

    let taxRate = data.taxRate;
    if (taxRate === undefined && order.taxRate !== null) {
      taxRate = Number(order.taxRate);
    }
    taxRate = taxRate || 0;

    const taxMultiplier = taxRate > 1 ? taxRate / 100 : taxRate;
    const taxAmount = subtotal * taxMultiplier;
    let amount = subtotal + taxAmount;

    // Deduct DP amount if DP Bill was paid
    const dpAmount = order.dpAmount ? Number(order.dpAmount) : 0;
    let dpDeductedNow = 0;
    let dpBillId: string | undefined;

    if (dpAmount > 0) {
      // Find the PAID DP Bill
      const dpBill = await this.repository.findFirst({
        orderId: data.orderId,
        companyId,
        type: InvoiceType.BILL,
        status: InvoiceStatus.PAID,
        isDownPayment: true,
      });

      if (dpBill) {
        dpBillId = dpBill.id;
        // Calculate already deducted DP from previous bills
        const alreadyDeducted =
          await this.repository.sumDeductedDpByOrderId(
            data.orderId,
            companyId
          );
        const remainingDp = dpAmount - alreadyDeducted;

        if (remainingDp > 0) {
          // Deduct remaining DP, capped by current bill amount
          dpDeductedNow = Math.min(remainingDp, amount);
          amount = amount - dpDeductedNow;
        }
      }
    }

    // Create lines from order items
    const createData: Prisma.InvoiceUncheckedCreateInput = {
      companyId,
      orderId: data.orderId,
      partnerId: order.partnerId,
      type: InvoiceType.BILL,
      status: InvoiceStatus.DRAFT,
      invoiceNumber,
      dpBillId, // Feature: Link to DP Bill
      supplierInvoiceNumber: data.supplierInvoiceNumber,
      notes:
        dpDeductedNow > 0
          ? `Final Bill (DP deducted: Rp ${dpDeductedNow.toLocaleString()})`
          : undefined,
      amount,
      subtotal, // Keep original subtotal for journal and reconstruction
      taxAmount, // Keep original tax for journal and reconstruction
      taxRate,
      balance: amount,
      dueDate:
        data.dueDate ||
        calculateDueDate(
          new Date(),
          order.paymentTerms || PaymentTerms.NET30
        ),
      paymentTermsString:
        order.paymentTerms || data.paymentTermsString || 'NET30',
    };

    return this.repository.create(createData);
  }

  /**
   * Create a Down Payment Bill for UPFRONT Payment Terms or Tempo+DP.
   * Called automatically when confirming a PO with:
   * - UPFRONT terms (100% DP)
   * - Tempo terms with dpAmount > 0 (partial DP)
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

    // Must have DP requirement (UPFRONT or dpAmount > 0)
    const dpAmount = order.dpAmount ? Number(order.dpAmount) : 0;
    const isUpfront = order.paymentTerms === PaymentTerms.UPFRONT;

    if (!isUpfront && dpAmount <= 0) {
      throw new DomainError(
        'DP Bill can only be created for UPFRONT payment terms or orders with dpAmount > 0',
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

    // Calculate amounts based on DP type
    let amount: number;
    let subtotal: number;
    let taxAmount: number;
    const taxRate = order.taxRate ? Number(order.taxRate) : 0;
    const taxMultiplier = taxRate > 1 ? taxRate / 100 : taxRate;

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
      type: InvoiceType.BILL,
      status: InvoiceStatus.DRAFT,
      invoiceNumber,
      notes: `Down Payment Bill (${dpPercent}%) for PO ${order.orderNumber || orderId}`,
      amount,
      subtotal,
      taxAmount,
      taxRate,
      balance: amount,
      dueDate: new Date(), // Immediate payment required for DP
      paymentTermsString: isUpfront ? 'UPFRONT' : `DP ${dpPercent}%`,
      isDownPayment: true, // Feature: Explicit DP Linking
    };

    return this.repository.create(createData);
  }

  async getById(id: string, companyId: string) {
    return this.repository.findById(id, companyId, InvoiceType.BILL);
  }

  async list(companyId: string, status?: string) {
    // Validate status if provided - only allow valid InvoiceStatus values
    const validStatuses: InvoiceStatus[] = [
      InvoiceStatus.DRAFT,
      InvoiceStatus.POSTED,
      InvoiceStatus.PAID,
      InvoiceStatus.VOID,
    ];
    const validatedStatus =
      status && validStatuses.includes(status as InvoiceStatus)
        ? (status as InvoiceStatus)
        : undefined;

    return this.repository.findAll(
      companyId,
      InvoiceType.BILL,
      validatedStatus
    );
  }

  /**
   * Create a Debit Note for Bill reversal (P2P returns/credits).
   * Issued by buyer to claim credit from supplier.
   * Similar to InvoiceService.createCreditNote but for AP (buyer's perspective).
   */
  async createDebitNote(
    companyId: string,
    originalBillId: string,
    _reason?: string
  ): Promise<Invoice> {
    const original = await this.repository.findById(
      originalBillId,
      companyId,
      InvoiceType.BILL
    );

    if (!original) {
      throw new DomainError(
        'Original bill not found',
        404,
        DomainErrorCodes.BILL_NOT_FOUND
      );
    }

    // Check status is reversible
    if (
      original.status !== InvoiceStatus.POSTED &&
      original.status !== InvoiceStatus.PAID
    ) {
      throw new DomainError(
        `Cannot reverse bill with status ${original.status}. Only POSTED or PAID bills can be credited.`,
        422,
        DomainErrorCodes.BILL_INVALID_STATE
      );
    }

    // Generate Debit Note Number
    const dnNumber = await this.documentNumberService.generate(
      companyId,
      'DN'
    );

    // Create Debit Note (using DEBIT_NOTE type - buyer's perspective)
    const debitNote = await this.repository.create({
      companyId,
      partnerId: original.partnerId,
      type: InvoiceType.DEBIT_NOTE,
      status: InvoiceStatus.POSTED, // Auto-post for reversal
      invoiceNumber: dnNumber,
      relatedInvoiceId: original.id,
      orderId: original.orderId,
      amount: original.amount,
      subtotal: original.subtotal,
      taxAmount: original.taxAmount,
      taxRate: original.taxRate,
      balance: 0,
      dueDate: new Date(),
      notes: `Debit Note for Bill ${original.invoiceNumber || originalBillId}`,
    });

    // Post journal to reverse AP: Dr AP (2100), Cr Purchase Returns (5200) / Accrual (2105)
    await this.journalService.postDebitNote(
      companyId,
      debitNote.id,
      dnNumber,
      Number(debitNote.amount),
      Number(debitNote.subtotal),
      Number(debitNote.taxAmount)
    );

    return debitNote;
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

        // FR-011, FR-020: 3-Way Matching Validation
        // Only for Bills linked to a PO (orderId exists)
        if (bill.orderId) {
          const order = await this.purchaseOrderRepository.findById(
            bill.orderId,
            companyId,
            tx
          );
          if (order) {
            const receivedQtyMap =
              await this.purchaseOrderRepository.getReceivedQuantities(
                bill.orderId,
                tx
              );
            BillPolicy.validate3WayMatching(
              {
                amount: bill.amount,
                subtotal: bill.subtotal,
                notes: bill.notes,
              },
              {
                items: order.items,
                totalAmount: order.totalAmount,
                dpAmount: order.dpAmount,
                paymentTerms: order.paymentTerms,
                taxRate: order.taxRate, // For tax-adjusted DP deduction
              },
              receivedQtyMap
            );
          }
        }

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
          throw new DomainError(
            `Bill ${id} has no bill number`,
            500,
            DomainErrorCodes.BILL_INVALID_STATE
          );
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
                  paymentType: PaymentTerms.UPFRONT,
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
      documentName: 'Bill',
      requiredPermission: 'bill:void',
      userPermissions,
      auditAction: AuditLogAction.BILL_VOIDED,
      entityType: EntityType.BILL,
      notFoundErrorCode: DomainErrorCodes.BILL_NOT_FOUND,
      invalidStateErrorCode: DomainErrorCodes.BILL_INVALID_STATE,
      hasPaymentsErrorCode: DomainErrorCodes.BILL_HAS_PAYMENTS,
    };

    // Validate permission, reason, and record audit
    await validateAndAuditVoid(voidConfig);

    return prisma.$transaction(
      async (tx) => {
        // Lock row for concurrency safety
        await tx.$executeRaw`SELECT 1 FROM "Invoice" WHERE id = ${id} FOR UPDATE`;

        // Validate document
        const bill = await this.repository.findById(
          id,
          companyId,
          InvoiceType.BILL,
          tx
        );
        const paymentCount = await this.repository.countPayments(
          id,
          companyId,
          tx
        );
        validateCanVoid(bill, paymentCount, voidConfig);

        // If POSTED, reverse the AP journal entry
        if (bill!.status === InvoiceStatus.POSTED) {
          await this.journalService.postBillReversal(
            companyId,
            bill!.id,
            bill!.invoiceNumber || '',
            Number(bill!.amount),
            Number(bill!.subtotal) || undefined,
            Number(bill!.taxAmount) || undefined,
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
    if (!bill)
      throw new DomainError(
        'Bill not found',
        404,
        DomainErrorCodes.BILL_NOT_FOUND
      );
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
