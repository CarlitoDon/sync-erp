import { z } from 'zod';
import { CashTransactionTypeSchema } from '../generated/zod/index.js';

// ============================================
// Bank Account Schemas
// ============================================

export const BankAccountTypeSchema = z.enum(['BANK', 'CASH']);
export type BankAccountType = z.infer<typeof BankAccountTypeSchema>;

export const createBankAccountSchema = z.object({
  bankName: z.string().min(1, 'Bank name is required'),
  accountNumber: z.string().optional().nullable(),
  currency: z.string().default('IDR'),
  accountType: BankAccountTypeSchema.default('BANK'),
});

export const updateBankAccountSchema = z.object({
  bankName: z.string().min(1, 'Bank name is required').optional(),
  accountNumber: z.string().optional().nullable(),
  isArchived: z.boolean().optional(),
});

// ============================================
// Transaction Schemas
// ============================================

export const cashTransactionItemSchema = z.object({
  accountId: z.string().uuid(),
  description: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
});

export const createCashTransactionSchema = z.object({
  type: CashTransactionTypeSchema,
  date: z.string().datetime().or(z.date()), // Accepts ISO string or Date object
  reference: z.string().optional(),
  payee: z.string().optional(),
  description: z.string().optional(),

  // SPEND: source is required
  // RECEIVE: destination is required
  // TRANSFER: both required
  sourceBankAccountId: z.string().uuid().optional().nullable(),
  destinationBankAccountId: z.string().uuid().optional().nullable(),

  // For SPEND/RECEIVE (Splits)
  items: z.array(cashTransactionItemSchema).optional(),

  // For TRANSFER (Single Amount)
  amount: z.number().positive('Amount must be positive').optional(),
});

export const updateCashTransactionSchema =
  createCashTransactionSchema.partial();

export const voidCashTransactionSchema = z.object({
  reason: z.string().min(1, 'Void reason is required'),
});

export type CreateBankAccountInput = z.infer<
  typeof createBankAccountSchema
>;
export type UpdateBankAccountInput = z.infer<
  typeof updateBankAccountSchema
>;
export type CreateCashTransactionInput = z.infer<
  typeof createCashTransactionSchema
>;
export type UpdateCashTransactionInput = z.infer<
  typeof updateCashTransactionSchema
>;
export type VoidCashTransactionInput = z.infer<
  typeof voidCashTransactionSchema
>;
