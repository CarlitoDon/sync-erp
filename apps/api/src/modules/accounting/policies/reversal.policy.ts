import { Invoice, InvoiceStatus } from '@sync-erp/database';

/**
 * Reversal Policy
 *
 * Defines rules for when reversals (Credit Notes, Journal Reversals) are allowed.
 * This enforces business constraints on undo operations.
 */

// Maximum age (in days) for reversing an invoice
const MAX_REVERSAL_AGE_DAYS = 90;

// Statuses that can be reversed
const REVERSIBLE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.POSTED,
  InvoiceStatus.PAID,
];

export interface ReversalPolicyResult {
  allowed: boolean;
  reason?: string;
}

export class ReversalPolicy {
  /**
   * Check if an invoice can be credited (reversed via Credit Note)
   */
  static canCreateCreditNote(invoice: Invoice): ReversalPolicyResult {
    // Rule 1: Check status
    if (!REVERSIBLE_STATUSES.includes(invoice.status)) {
      return {
        allowed: false,
        reason: `Cannot reverse invoice with status ${invoice.status}. Only POSTED or PAID invoices can be credited.`,
      };
    }

    // Rule 2: Check if already has a credit note (via relatedInvoiceId check done at repository level)
    // This would require checking if any CREDIT_NOTE references this invoice
    // For now, we allow multiple credit notes (partial credits)

    // Rule 3: Check age (only if createdAt exists - for new invoices)
    if (invoice.createdAt) {
      const ageInDays = Math.floor(
        (Date.now() - invoice.createdAt.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (ageInDays > MAX_REVERSAL_AGE_DAYS) {
        return {
          allowed: false,
          reason: `Invoice is ${ageInDays} days old. Maximum reversal age is ${MAX_REVERSAL_AGE_DAYS} days.`,
        };
      }
    }

    // Rule 4: VOID invoices cannot be credited
    if (invoice.status === InvoiceStatus.VOID) {
      return {
        allowed: false,
        reason: 'Cannot credit a voided invoice.',
      };
    }

    return { allowed: true };
  }

  /**
   * Check if a journal entry can be reversed
   */
  static canReverseJournal(
    journalCreatedAt: Date,
    isAlreadyReversed: boolean
  ): ReversalPolicyResult {
    // Rule 1: Check if already reversed
    if (isAlreadyReversed) {
      return {
        allowed: false,
        reason: 'This journal entry has already been reversed.',
      };
    }

    // Rule 2: Check age
    const ageInDays = Math.floor(
      (Date.now() - journalCreatedAt.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (ageInDays > MAX_REVERSAL_AGE_DAYS) {
      return {
        allowed: false,
        reason: `Journal entry is ${ageInDays} days old. Maximum reversal age is ${MAX_REVERSAL_AGE_DAYS} days.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Check if a stock return is allowed
   */
  static canProcessReturn(
    shipmentDate: Date,
    orderStatus: string
  ): ReversalPolicyResult {
    // Rule 1: Only COMPLETED orders can have returns
    if (orderStatus !== 'COMPLETED') {
      return {
        allowed: false,
        reason: `Cannot process return for order with status ${orderStatus}. Only COMPLETED orders can be returned.`,
      };
    }

    // Rule 2: Check age of shipment
    const ageInDays = Math.floor(
      (Date.now() - shipmentDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (ageInDays > MAX_REVERSAL_AGE_DAYS) {
      return {
        allowed: false,
        reason: `Shipment is ${ageInDays} days old. Maximum return age is ${MAX_REVERSAL_AGE_DAYS} days.`,
      };
    }

    return { allowed: true };
  }
}

// Export configurable constants for tests
export const REVERSAL_POLICY_CONFIG = {
  MAX_REVERSAL_AGE_DAYS,
  REVERSIBLE_STATUSES,
};
