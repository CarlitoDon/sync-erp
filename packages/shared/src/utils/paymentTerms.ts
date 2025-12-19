import { PAYMENT_TERMS } from '../constants/index.js';

/**
 * Calculate due date based on payment terms
 * @param invoiceDate - The invoice date
 * @param termsCode - Payment terms code (NET7, NET30, etc.)
 * @returns Calculated due date
 */
export function calculateDueDate(
  invoiceDate: Date,
  termsCode: string
): Date {
  const terms = PAYMENT_TERMS.find((t) => t.code === termsCode);

  if (!terms) {
    // Default to 30 days if invalid term
    return addDays(invoiceDate, 30);
  }

  if (terms.code === 'EOM') {
    // End of Month: Due at the end of the month of the invoice
    const date = new Date(invoiceDate);
    date.setMonth(date.getMonth() + 1, 0); // Last day of invoice month
    return date;
  }

  // Standard terms: Add days
  return addDays(invoiceDate, terms.days);
}

/**
 * Helper function to add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Get payment term label by code
 */
export function getPaymentTermLabel(termsCode: string): string {
  return (
    PAYMENT_TERMS.find((t) => t.code === termsCode)?.label ||
    termsCode
  );
}
