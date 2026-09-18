import { describe, it, expect } from 'vitest';
import { prisma } from './setup';

describe('Finance Invariants', () => {
  it('should never have negative invoice balance', async () => {
    // In Phase 1, overpayment is not allowed, so balance >= 0 is a hard constraint
    const invalidInvoices = await prisma.invoice.findMany({
      where: {
        balance: {
          lt: 0,
        },
      },
      select: {
        id: true,
        invoiceNumber: true,
        balance: true,
      },
    });

    if (invalidInvoices.length > 0) {
      console.error(
        'Found invoices with negative balance:',
        invalidInvoices
      );
    }

    expect(invalidInvoices).toHaveLength(0);
  });

  it('should ensure invoice amount integrity (amount = subtotal + tax or with DP deduction)', async () => {
    // We can't do exact math in SQL easily across all DBs without raw query,
    // but we can fetch and check JS side for the suite.
    // Or use raw query if we want performance. For now, fetch is safer for Phase 1.
    // Just check a sample or all? For 'test floor', we want high confidence.
    // Let's check all, assuming test DB isn't huge.

    const invoices = await prisma.invoice.findMany({
      select: {
        id: true,
        amount: true,
        subtotal: true,
        taxAmount: true,
        dpBillId: true,
        notes: true,
      },
    });

    const brokenMath = invoices.filter(inv => {
      const standardCalc = Number(inv.subtotal) + Number(inv.taxAmount);
      const actual = Number(inv.amount);
      
      // If invoice has dpBillId or is a DP invoice, amount <= standardCalc
      if (inv.dpBillId || inv.notes?.includes('Down Payment') || inv.notes?.includes('DP')) {
        return actual > standardCalc + 0.01;
      }
      
      // Standard case (no DP): amount = subtotal + taxAmount
      // extensive floating point check? Decimal.js is used in app but Prisma returns Decimal/string/number depending on config.
      // Prisma default for Decimal is usually a Decimal object or string.
      // Let's rely on Number() for the test floor check with a small epsilon if needed,
      // but typically financial systems should match exact cents.
      return Math.abs(standardCalc - actual) > 0.01;
    });

    if (brokenMath.length > 0) {
      console.error(
        'Found invoices with math mismatch:',
        brokenMath.slice(0, 5).map(inv => ({
          id: inv.id,
          amount: Number(inv.amount),
          subtotal: Number(inv.subtotal),
          taxAmount: Number(inv.taxAmount),
          dpBillId: inv.dpBillId,
          calculated: Number(inv.subtotal) + Number(inv.taxAmount),
        }))
      );
    }

    expect(brokenMath).toHaveLength(0);
  });
});
