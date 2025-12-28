import {
  Invoice,
  InvoiceStatus,
  OrderStatus,
  PaymentTerms,
} from '@sync-erp/database';
import {
  BusinessDate,
  DomainError,
  DomainErrorCodes,
} from '@sync-erp/shared';
import { Decimal } from 'decimal.js';

export class InvoicePolicy {
  /**
   * Validate creation rules
   */
  static validateCreate(data: {
    businessDate?: Date;
    invoiceNumber?: string;
  }) {
    if (data.businessDate) {
      BusinessDate.from(data.businessDate).ensureValid();
    }
  }

  /**
   * Validate update rules
   * - Immutable fields: invoiceNumber
   * - State Guard: Must be DRAFT
   */
  static validateUpdate(
    existing: Invoice,
    data: { invoiceNumber?: string; memo?: string }
  ) {
    if (existing.status !== InvoiceStatus.DRAFT) {
      throw new DomainError(
        'Invoice is not in the correct state for this action',
        422,
        DomainErrorCodes.INVOICE_INVALID_STATE
      );
    }

    if (
      data.invoiceNumber &&
      data.invoiceNumber !== existing.invoiceNumber
    ) {
      throw new DomainError(
        'Invoice number cannot be changed',
        400,
        DomainErrorCodes.MUTATION_BLOCKED
      );
    }
  }

  /**
   * Validate invoice can be posted (must be DRAFT)
   */
  static validatePost(status: string): void {
    if (status !== InvoiceStatus.DRAFT) {
      throw new DomainError(
        `Cannot post invoice with status ${status}`,
        422,
        DomainErrorCodes.INVOICE_INVALID_STATE
      );
    }
  }

  /**
   * Ensure the Sales Order is in a valid state for Invoice creation.
   * SO must be CONFIRMED, PARTIALLY_SHIPPED, SHIPPED, or COMPLETED.
   */
  static ensureOrderReadyForInvoice(order: { status: string }): void {
    const validStatuses = [
      OrderStatus.CONFIRMED,
      OrderStatus.PARTIALLY_SHIPPED,
      OrderStatus.SHIPPED,
      OrderStatus.COMPLETED,
    ];
    if (
      !validStatuses.includes(
        order.status as (typeof validStatuses)[number]
      )
    ) {
      throw new DomainError(
        `Cannot create invoice: SO status is ${order.status}, must be CONFIRMED or later`,
        400,
        DomainErrorCodes.ORDER_INVALID_STATE
      );
    }
  }

  /**
   * Ensure shipment exists before allowing Invoice creation/posting.
   * Mirrors BillPolicy.ensureGoodsReceived() for O2C.
   */
  static ensureShipmentExists(shipmentCount: number): void {
    if (shipmentCount === 0) {
      throw new DomainError(
        'Cannot post invoice: Goods have not been shipped (no Shipment found)',
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }
  }

  /**
   * 3-Way Matching Validation for O2C
   *
   * Validates that Invoice qty/price matches SO and Shipment:
   * - Invoice qty MUST equal Shipment delivered qty per product
   * - Invoice subtotal MUST equal SO total (minus DP if applicable)
   *
   * SKIP conditions (no 3-way matching):
   * - DP Invoices (notes contains "Down Payment") - created before Shipment
   * - UPFRONT Invoices when no Shipment exists yet - pre-delivery payment
   *
   * @param invoice - The invoice being posted
   * @param order - The linked sales order with items
   * @param shippedQtyByProduct - Map of productId -> total shipped qty from Shipments
   * @param isDpInvoice - Whether this is a Down Payment invoice
   */
  static validate3WayMatching(
    invoice: {
      amount: Decimal | number;
      subtotal: Decimal | number;
      notes?: string | null;
    },
    order: {
      items: Array<{
        productId: string;
        quantity: number;
        price: Decimal | number;
      }>;
      totalAmount: Decimal | number;
      dpAmount?: Decimal | number | null;
      paymentTerms?: string | null;
    },
    shippedQtyByProduct: Map<string, number>,
    isDpInvoice: boolean = false
  ): void {
    // 1. Skip for DP Invoices (created before Shipment, no matching needed)
    if (isDpInvoice || invoice.notes?.includes('Down Payment')) {
      return;
    }

    // 2. Skip for UPFRONT with no Shipment yet (pre-delivery payment)
    if (
      order.paymentTerms === PaymentTerms.UPFRONT &&
      shippedQtyByProduct.size === 0
    ) {
      return;
    }

    // 3. Enforce 3-way matching for Final Invoices
    // Calculate expected subtotal from SO items (qty * price)
    const soSubtotal = order.items.reduce(
      (sum, item) => sum + item.quantity * Number(item.price),
      0
    );

    // Deduct DP from expected subtotal if applicable
    const dpPaid = order.dpAmount ? Number(order.dpAmount) : 0;

    let expectedSubtotal = soSubtotal;
    if (dpPaid > 0) {
      // DP was paid, final invoice should have reduced subtotal
      expectedSubtotal = soSubtotal - dpPaid;
    }

    const actualSubtotal = Number(invoice.subtotal);

    // 3a. Subtotal Match (pre-tax comparison)
    // Allow small tolerance for rounding (1 IDR)
    const subtotalDiff = Math.abs(actualSubtotal - expectedSubtotal);
    if (subtotalDiff > 1) {
      throw new DomainError(
        `3-way matching failed: Subtotal mismatch (Expected: ${expectedSubtotal.toLocaleString()}, Invoice: ${actualSubtotal.toLocaleString()})`,
        422,
        DomainErrorCodes.THREE_WAY_MATCH_FAILED
      );
    }

    // 3b. Qty Match (Invoice qty must equal total Shipment qty per product)
    for (const item of order.items) {
      const shippedQty = shippedQtyByProduct.get(item.productId) || 0;
      if (shippedQty !== item.quantity) {
        throw new DomainError(
          `3-way matching failed: Qty mismatch for product (Ordered: ${item.quantity}, Shipped: ${shippedQty})`,
          422,
          DomainErrorCodes.THREE_WAY_MATCH_FAILED
        );
      }
    }
  }
}
