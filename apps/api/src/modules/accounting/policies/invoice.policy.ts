/**
 * InvoicePolicy - O2C (Order-to-Cash) Invoice Validation
 *
 * Domain-specific validation for Invoices (customer invoices).
 * Uses shared utilities from document-validation.utils.ts.
 */

import {
  Invoice,
  InvoiceStatus,
  OrderStatus,
} from '@sync-erp/database';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';
import {
  validateBusinessDate,
  validateDraftStatus,
  validateOrderStatus,
  ensureFulfillmentExists,
  validate3WayMatching,
  type ThreeWayMatchDocument,
  type ThreeWayMatchOrder,
} from '../../common/utils/document-validation.utils';

// Valid SO statuses for Invoice creation
const VALID_SO_STATUSES = [
  OrderStatus.CONFIRMED,
  OrderStatus.PARTIALLY_SHIPPED,
  OrderStatus.SHIPPED,
  OrderStatus.COMPLETED,
];

export class InvoicePolicy {
  /**
   * Validate creation rules
   */
  static validateCreate(data: {
    businessDate?: Date;
    invoiceNumber?: string;
  }): void {
    validateBusinessDate(data.businessDate);
  }

  /**
   * Validate update rules
   * - Immutable fields: invoiceNumber
   * - State Guard: Must be DRAFT
   */
  static validateUpdate(
    existing: Invoice,
    data: { invoiceNumber?: string; memo?: string }
  ): void {
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
    validateDraftStatus(
      status,
      'Invoice',
      DomainErrorCodes.INVOICE_INVALID_STATE
    );
  }

  /**
   * Ensure SO is in valid state for Invoice creation
   */
  static ensureOrderReadyForInvoice(order: { status: string }): void {
    validateOrderStatus(
      order.status,
      VALID_SO_STATUSES,
      'Invoice',
      'SO'
    );
  }

  /**
   * Ensure Shipment exists before Invoice posting
   */
  static ensureShipmentExists(shipmentCount: number): void {
    ensureFulfillmentExists(shipmentCount, 'Invoice', 'Shipment');
  }

  /**
   * 3-Way Matching Validation for O2C
   *
   * Validates that Invoice qty/price matches SO and Shipment.
   */
  static validate3WayMatching(
    invoice: ThreeWayMatchDocument,
    order: ThreeWayMatchOrder,
    shippedQtyByProduct: Map<string, number>,
    isDpInvoice: boolean = false
  ): void {
    validate3WayMatching(
      invoice,
      order,
      shippedQtyByProduct,
      'Invoice',
      'Shipped',
      isDpInvoice
    );
  }
}
