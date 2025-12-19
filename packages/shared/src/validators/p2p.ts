import { z } from 'zod';
import { PAYMENT_METHODS } from '../constants/index.js';

// ==========================================
// Purchase Order Validators
// ==========================================

export const CreatePurchaseOrderSchema = z.object({
  partnerId: z.string().uuid(),
  date: z.coerce.date().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().positive(),
        price: z.number().min(0),
      })
    )
    .min(1),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
  taxRate: z.number().min(0).optional(),
});

// ==========================================
// Goods Receipt Validators
// ==========================================

export const CreateP2PGoodsReceiptSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  date: z.coerce.date().optional(),
  receivedBy: z.string().min(1), // Use ID, but ensure not empty
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        purchaseOrderItemId: z.string().uuid(),
        quantity: z.number().positive(),
        productId: z.string().uuid(),
      })
    )
    .min(1),
});

// ==========================================
// Bill Validators
// ==========================================

export const CreateP2PBillSchema = z.object({
  orderId: z.string().uuid().optional(),
  partnerId: z.string().uuid(),
  date: z.coerce.date(),
  dueDate: z.coerce.date(),
  supplierInvoiceNumber: z.string().min(1),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        grnLineId: z.string().uuid().optional(),
        description: z.string().optional(),
        quantity: z.number().positive(),
        price: z.number().min(0),
      })
    )
    .min(1),
  taxRate: z.number().min(0).optional(),
});

export const CreateBillFromPOSchema = z.object({
  orderId: z.string().uuid(),
  invoiceNumber: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  taxRate: z.number().optional(),
  businessDate: z.coerce.date().optional(),
  paymentTermsString: z.string().optional(),
  items: z
    .array(
      z.object({
        grnLineId: z.string().uuid(),
        quantity: z.number().positive(),
        price: z.number().min(0),
      })
    )
    .optional(), // If empty, assume full bill from all unbilled GRNs? Better explicit.
});
// Note: We might refine CreateBillFromPOSchema during implementation if logic changes

// ==========================================
// Payment Validators
// ==========================================

export const CreateP2PPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(PAYMENT_METHODS),
  accountId: z.string().uuid(),
  reference: z.string().optional(),
  date: z.coerce.date(),
  notes: z.string().optional(),
});
