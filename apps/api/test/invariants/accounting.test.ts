import { describe, it, expect } from 'vitest';
import { prisma } from './setup';

describe('Accounting Invariants', () => {
  it('should ensure all Journal Entries are balanced (Debit == Credit)', async () => {
    // We fetch lines grouped by journalId and sum them
    // In SQL: SELECT journalId, SUM(debit), SUM(credit) FROM JournalLine GROUP BY journalId HAVING SUM(debit) != SUM(credit)

    // Prisma groupBy is good for this
    const balances = await prisma.journalLine.groupBy({
      by: ['journalId'],
      _sum: {
        debit: true,
        credit: true,
      },
    });

    const unbalanced = balances.filter((b) => {
      const debit = Number(b._sum.debit || 0);
      const credit = Number(b._sum.credit || 0);
      return Math.abs(debit - credit) > 0.01;
    });

    if (unbalanced.length > 0) {
      console.error(
        'Found unbalanced journals:',
        unbalanced.slice(0, 5)
      );
    }

    expect(unbalanced).toHaveLength(0);
  });

  it('should ensure every Journal Entry has at least 2 lines', async () => {
    // A journal with 0 or 1 line is invalid (unless 1 line has 0/0 but that's useless)

    // Find journals that don't have enough lines.
    // This is harder with pure Prisma groupBy, let's try counting.

    const counts = await prisma.journalLine.groupBy({
      by: ['journalId'],
      _count: {
        id: true,
      },
    });

    const invalidCounts = counts.filter((c) => c._count.id < 2);

    if (invalidCounts.length > 0) {
      console.error(
        'Found journals with < 2 lines:',
        invalidCounts.slice(0, 5)
      );
    }

    expect(invalidCounts).toHaveLength(0);
  });
});
