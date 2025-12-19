import {
  Invoice,
  InvoiceStatus,
  InvoiceType,
  OrderType,
  Prisma,
  AuditLogAction,
  EntityType,
} from '@sync-erp/database';
import { InvoiceRepository } from '../repositories/invoice.repository';
import {
  BusinessDate,
  DomainError,
  DomainErrorCodes,
} from '@sync-erp/shared';

export interface CreateBillInput {
  orderId: string;
  invoiceNumber?: string;
  dueDate?: Date;
  taxRate?: number;
  businessDate?: Date;
  paymentTermsString?: string;
} // G5

import { DocumentNumberService } from '../../common/services/document-number.service';
import { BillPostingSaga } from '../sagas/bill-posting.saga';
import { BillPolicy } from '../policies/bill.policy';
import { InventoryRepository } from '../../inventory/inventory.repository.js';
import * as auditLogService from '../../common/audit/audit-log.service';

export class BillService {
  private repository = new InvoiceRepository();
  private inventoryRepository = new InventoryRepository();
  private documentNumberService = new DocumentNumberService();
  private billPostingSaga = new BillPostingSaga();

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

    let invoiceNumber = data.invoiceNumber;
    if (!invoiceNumber) {
      invoiceNumber = await this.documentNumberService.generate(
        companyId,
        'BILL'
      );
    }

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
      amount,
      subtotal,
      taxAmount,
      taxRate,
      balance: amount,
      dueDate:
        data.dueDate ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      paymentTermsString: data.paymentTermsString || 'NET30', // Store payment terms
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
   * Post bill using saga pattern for atomic execution with compensation.
   * If posting fails mid-way, compensation will automatically reverse changes.
   * @throws SagaCompensatedError if posting fails but was compensated
   * @throws SagaCompensationFailedError if compensation also fails
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
    }

    const bill = await this.repository.findById(
      id,
      companyId,
      InvoiceType.BILL
    );
    if (!bill) {
      throw new DomainError(
        'Bill not found',
        404,
        DomainErrorCodes.BILL_NOT_FOUND
      );
    }

    if (bill.status !== InvoiceStatus.DRAFT) {
      throw new DomainError(
        `Cannot post bill with status ${bill.status}`,
        422,
        DomainErrorCodes.BILL_INVALID_STATE
      );
    }

    // FR-010.1: Record Audit Log BEFORE triggering Saga
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

    const result = await this.billPostingSaga.execute(
      { billId: id, companyId, businessDate },
      id,
      companyId,
      correlationId // FR-010: Pass correlationId to saga
    );

    if (!result.success || !result.data) {
      throw result.error || new Error('Bill posting failed');
    }

    return result.data;
  }

  async void(id: string, companyId: string): Promise<Invoice> {
    const bill = await this.repository.findById(
      id,
      companyId,
      InvoiceType.BILL
    );
    if (!bill) {
      throw new Error('Bill not found');
    }

    if (bill.status === InvoiceStatus.PAID) {
      throw new DomainError(
        'Cannot void a paid bill',
        422,
        DomainErrorCodes.BILL_INVALID_STATE
      );
    }

    return this.repository.update(id, {
      status: InvoiceStatus.VOID,
    });
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
