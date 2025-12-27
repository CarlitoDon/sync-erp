/* eslint-disable @sync-erp/no-hardcoded-enum */
// Above: False positive - we're using PaymentTerms enum from database, not hardcoded strings

import { PaymentTerms } from '@sync-erp/database';

/**
 * Payment terms days mapping
 * GAP-002: Due date calculation from payment terms
 */
const PAYMENT_TERMS_DAYS: Record<PaymentTerms, number | 'EOM'> = {
  [PaymentTerms.NET7]: 7,
  [PaymentTerms.NET30]: 30,
  [PaymentTerms.NET_30]: 30, // Legacy alias
  [PaymentTerms.NET60]: 60,
  [PaymentTerms.NET90]: 90,
  [PaymentTerms.COD]: 0,
  [PaymentTerms.UPFRONT]: 0,
  [PaymentTerms.EOM]: 'EOM',
};

/**
 * Calculate due date based on invoice date and payment terms
 *
 * @param invoiceDate - The invoice/bill date
 * @param terms - Payment terms (NET30, NET60, COD, etc.)
 * @returns Calculated due date
 */
export function calculateDueDate(
  invoiceDate: Date,
  terms: PaymentTerms
): Date {
  const days = PAYMENT_TERMS_DAYS[terms];

  if (days === 'EOM') {
    // End of Month: last day of invoice month
    const nextMonth = new Date(
      invoiceDate.getFullYear(),
      invoiceDate.getMonth() + 1,
      0 // Day 0 of next month = last day of current month
    );
    return nextMonth;
  }

  // Add days to invoice date
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + days);
  return dueDate;
}

/**
 * Get number of days for payment terms (for display purposes)
 */
export function getPaymentTermsDays(terms: PaymentTerms): number {
  const days = PAYMENT_TERMS_DAYS[terms];
  if (days === 'EOM') {
    return 30; // Approximate for display
  }
  return days;
}
