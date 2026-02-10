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
import { Decimal } from 'decimal.js';
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
    ensureFulfillmentExists(shipmentCount, 'Invoice', 'SHIPMENT');
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
      'SHIPPED',
      isDpInvoice
    );
  }

  /**
   * Feature 041: Validate not over-invoicing
   * Prevents creating invoices whose subtotal exceeds remaining uninvoiced order value.
   * Note: DP is NOT subtracted here because DP is a pre-payment mechanism,
   * not a restriction on what can be invoiced.
   */
  static validateNotOverInvoicing(
    newInvoiceSubtotal: Decimal,
    existingInvoicedTotal: Decimal,
    orderSubtotal: Decimal
  ): void {
    const maxInvoiceable = orderSubtotal.minus(existingInvoicedTotal);
    // Allow 1 IDR tolerance for rounding
    if (newInvoiceSubtotal.greaterThan(maxInvoiceable.plus(1))) {
      throw new DomainError(
        `Invoice subtotal (${newInvoiceSubtotal.toFixed(0)}) exceeds remaining uninvoiced value. Max invoiceable: ${maxInvoiceable.toFixed(0)}`,
        400,
        DomainErrorCodes.EXCEEDS_ORDER_VALUE
      );
    }
  }

  /**
   * Feature 041: Validate fulfillment not already invoiced
   * Prevents invoicing the same Shipment twice (unless previous invoice was voided).
   */
  static validateFulfillmentNotInvoiced(fulfillment: {
    invoices?: { id: string; status: InvoiceStatus }[];
  }): void {
    // Filter out VOID invoices - allow re-invoicing if all linked invoices are voided
    const activeInvoices =
      fulfillment.invoices?.filter(
        (inv) => inv.status !== InvoiceStatus.VOID
      ) || [];

    if (activeInvoices.length > 0) {
      throw new DomainError(
        'This Shipment already has an invoice linked to it',
        400,
        DomainErrorCodes.FULFILLMENT_ALREADY_INVOICED
      );
    }
  }
}
