import { z } from 'zod';
import { AccountType } from '../types/finance.js';

export const CreateAccountSchema = z.object({
  code: z
    .string()
    .min(3, 'Account code must be at least 3 characters')
    .max(10, 'Account code must be at most 10 characters')
    .regex(/^\d+$/, 'Account code must contain only numbers'),
  name: z.string().min(1, 'Account name is required'),
  type: AccountType,
});

export const CreateJournalLineSchema = z.object({
  accountId: z.string().uuid(),
  debit: z.number().min(0),
  credit: z.number().min(0),
});

export const CreateJournalSchema = z.object({
  date: z.coerce.date(),
  reference: z.string().optional(),
  memo: z.string().optional(),
  lines: z
    .array(CreateJournalLineSchema)
    .min(2)
    .refine(
      (lines) => {
        const totalDebit = lines.reduce(
          (sum, line) => sum + line.debit,
          0
        );
        const totalCredit = lines.reduce(
          (sum, line) => sum + line.credit,
          0
        );
        return Math.abs(totalDebit - totalCredit) < 0.01;
      },
      { message: 'Journal entry must be balanced (Debits = Credits)' }
    ),
});

export type CreateAccountInput = z.infer<typeof CreateAccountSchema>;
export type CreateJournalInput = z.infer<typeof CreateJournalSchema>;
