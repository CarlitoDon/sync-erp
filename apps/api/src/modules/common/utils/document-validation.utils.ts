/**
 * Shared Document Validation Utilities
 *
 * Common validation logic for Bill (P2P) and Invoice (O2C) policies.
 * Extracted to reduce code duplication while maintaining domain-specific policies.
 */

import { InvoiceStatus, PaymentTerms } from '@sync-erp/database';
import {
  BusinessDate,
  DomainError,
  DomainErrorCodes,
} from '@sync-erp/shared';
import { Decimal } from 'decimal.js';

/**
 * Document type for contextual error messages
 */
export type DocumentType = 'Bill' | 'Invoice';

/**
 * Validate business date is valid and not in blocked period
 */
export function validateBusinessDate(date?: Date): void {
  if (date) {
    try {
      BusinessDate.from(date).ensureValid();
    } catch {
      throw new DomainError(
        'Invalid business date provided',
        400,
        DomainErrorCodes.INVALID_DATE
      );
    }
  }
}

/**
 * Validate document is in DRAFT status before posting
 */
export function validateDraftStatus(
  status: string,
  docType: DocumentType,
  errorCode: string
): void {
  if (status !== InvoiceStatus.DRAFT) {
    throw new DomainError(
      `Cannot post ${docType.toLowerCase()} with status ${status}`,
      422,
      errorCode
    );
  }
}

/**
 * Validate order is in correct status for document creation
 */
export function validateOrderStatus(
  orderStatus: string,
  validStatuses: string[],
  docType: DocumentType,
  orderType: 'PO' | 'SO'
): void {
  if (!validStatuses.includes(orderStatus)) {
    throw new DomainError(
      `Cannot create ${docType.toLowerCase()}: ${orderType} status is ${orderStatus}, must be CONFIRMED or later`,
      400,
      DomainErrorCodes.ORDER_INVALID_STATE
    );
  }
}

/**
 * Validate fulfillment exists (GRN for Bill, Shipment for Invoice)
 */
export function ensureFulfillmentExists(
  count: number,
  docType: DocumentType,
  fulfillmentType: 'GRN' | 'Shipment'
): void {
  if (count === 0) {
    const action = fulfillmentType === 'GRN' ? 'received' : 'shipped';
    throw new DomainError(
      `Cannot ${docType === 'Bill' ? 'create bill' : 'post invoice'}: Goods have not been ${action} (no ${fulfillmentType} found)`,
      400,
      DomainErrorCodes.OPERATION_NOT_ALLOWED
    );
  }
}

/**
 * 3-Way Matching input for document
 */
export interface ThreeWayMatchDocument {
  amount: Decimal | number;
  subtotal: Decimal | number;
  notes?: string | null;
}

/**
 * 3-Way Matching input for order
 */
export interface ThreeWayMatchOrder {
  items: Array<{
    productId: string;
    quantity: number;
    price: Decimal | number;
  }>;
  totalAmount: Decimal | number;
  dpAmount?: Decimal | number | null;
  paymentTerms?: string | null;
}

/**
 * Validate 3-Way Matching between document, order, and fulfillment
 *
 * Shared logic for:
 * - Bill vs PO vs GRN (P2P)
 * - Invoice vs SO vs Shipment (O2C)
 *
 * @param document - Bill or Invoice being validated
 * @param order - PO or SO with items
 * @param qtyByProduct - Map of productId -> received/shipped quantity
 * @param docType - 'Bill' or 'Invoice' for error messages
 * @param fulfillmentType - 'Received' or 'Shipped' for error messages
 * @param isDownPayment - Skip validation for DP documents
 */
export function validate3WayMatching(
  document: ThreeWayMatchDocument,
  order: ThreeWayMatchOrder,
  qtyByProduct: Map<string, number>,
  docType: DocumentType,
  fulfillmentType: 'Received' | 'Shipped',
  isDownPayment: boolean = false
): void {
  // 1. Skip for DP documents (created before fulfillment)
  if (isDownPayment || document.notes?.includes('Down Payment')) {
    return;
  }

  // 2. Skip for UPFRONT with no fulfillment yet
  if (
    order.paymentTerms === PaymentTerms.UPFRONT &&
    qtyByProduct.size === 0
  ) {
    return;
  }

  // 3. Calculate expected subtotal from order items
  const orderSubtotal = order.items.reduce(
    (sum, item) => sum + item.quantity * Number(item.price),
    0
  );

  // Deduct DP if applicable
  const dpPaid = order.dpAmount ? Number(order.dpAmount) : 0;
  const expectedSubtotal =
    dpPaid > 0 ? orderSubtotal - dpPaid : orderSubtotal;
  const actualSubtotal = Number(document.subtotal);

  // 3a. Subtotal Match (allow 1 IDR tolerance for rounding)
  const subtotalDiff = Math.abs(actualSubtotal - expectedSubtotal);
  if (subtotalDiff > 1) {
    throw new DomainError(
      `3-way matching failed: Subtotal mismatch (Expected: ${expectedSubtotal.toLocaleString()}, ${docType}: ${actualSubtotal.toLocaleString()})`,
      422,
      DomainErrorCodes.THREE_WAY_MATCH_FAILED
    );
  }

  // 3b. Qty Match per product
  for (const item of order.items) {
    const fulfilledQty = qtyByProduct.get(item.productId) || 0;
    if (fulfilledQty !== item.quantity) {
      throw new DomainError(
        `3-way matching failed: Qty mismatch for product (Ordered: ${item.quantity}, ${fulfillmentType}: ${fulfilledQty})`,
        422,
        DomainErrorCodes.THREE_WAY_MATCH_FAILED
      );
    }
  }
}
