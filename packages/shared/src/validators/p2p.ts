import { z } from 'zod';
import {
  PaymentMethodTypeSchema,
  PaymentTermsSchema,
  PaymentStatusSchema,
} from '../generated/zod/index.js';

// ==========================================
// Feature 036: Cash Upfront Payment - Enums
// ==========================================

export type PaymentTerms = z.infer<typeof PaymentTermsSchema>;
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

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
  paymentTerms: PaymentTermsSchema.optional().default('NET30'), // Feature 036
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
  fulfillmentId: z.string().uuid().optional(), // Feature 041: Link to specific GRN/Receipt
  supplierInvoiceNumber: z.string().optional(), // External reference from supplier's invoice
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
  method: PaymentMethodTypeSchema,
  accountId: z.string().uuid(),
  reference: z.string().optional(),
  date: z.coerce.date(),
  notes: z.string().optional(),
});

// ==========================================
// Feature 036: Cash Upfront Payment Validators
// ==========================================

export const RegisterUpfrontPaymentSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.number().positive(),
  method: PaymentMethodTypeSchema,
  accountId: z.string().uuid().optional(),
  reference: z.string().max(100).optional(),
  businessDate: z.coerce.date().optional(),
});
export type RegisterUpfrontPaymentInput = z.infer<
  typeof RegisterUpfrontPaymentSchema
>;

export const SettlePrepaidSchema = z.object({
  billId: z.string().uuid(),
});
export type SettlePrepaidInput = z.infer<typeof SettlePrepaidSchema>;

// Response schemas
export const UpfrontPaymentResponseSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  orderId: z.string().uuid(),
  amount: z.number(),
  method: z.string(),
  reference: z.string().nullable(),
  paymentType: z.literal('UPFRONT'),
  settledAt: z.date().nullable(),
  createdAt: z.date(),
});
export type UpfrontPaymentResponse = z.infer<
  typeof UpfrontPaymentResponseSchema
>;

export const PaymentSummaryResponseSchema = z.object({
  totalAmount: z.number(),
  paidAmount: z.number(),
  remainingAmount: z.number(),
  paymentStatus: PaymentStatusSchema.nullable(),
  payments: z.array(UpfrontPaymentResponseSchema),
});
export type PaymentSummaryResponse = z.infer<
  typeof PaymentSummaryResponseSchema
>;

export const PrepaidInfoResponseSchema = z.object({
  billId: z.string().uuid(),
  billAmount: z.number(),
  billBalance: z.number(),
  hasPrepaid: z.boolean(),
  prepaid: z
    .object({
      paymentId: z.string().uuid(),
      orderId: z.string().uuid(),
      orderNumber: z.string().nullable(),
      amount: z.number(),
      paidAt: z.date(),
    })
    .nullable(),
  settlementAmount: z.number(),
  remainingAfterSettlement: z.number(),
});
export type PrepaidInfoResponse = z.infer<
  typeof PrepaidInfoResponseSchema
>;

export const SettlementResponseSchema = z.object({
  bill: z.object({
    id: z.string().uuid(),
    status: z.string(),
    balance: z.number(),
  }),
  settlement: z.object({
    amount: z.number(),
    journalId: z.string().uuid(),
    prepaidPaymentId: z.string().uuid(),
  }),
});
export type SettlementResponse = z.infer<
  typeof SettlementResponseSchema
>;

// ==========================================
// Cash Upfront Sales - Customer Deposit Validators
// ==========================================

export const RegisterCustomerDepositSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.number().positive(),
  method: PaymentMethodTypeSchema,
  accountId: z.string().uuid().optional(),
  reference: z.string().max(100).optional(),
  businessDate: z.coerce.date().optional(),
});
export type RegisterCustomerDepositInput = z.infer<
  typeof RegisterCustomerDepositSchema
>;

export const SettleCustomerDepositSchema = z.object({
  invoiceId: z.string().uuid(),
});
export type SettleCustomerDepositInput = z.infer<
  typeof SettleCustomerDepositSchema
>;

export const DepositInfoResponseSchema = z.object({
  invoiceId: z.string().uuid(),
  invoiceAmount: z.number(),
  invoiceBalance: z.number(),
  hasDeposit: z.boolean(),
  deposit: z
    .object({
      paymentId: z.string().uuid(),
      orderId: z.string().uuid(),
      orderNumber: z.string().nullable(),
      amount: z.number(),
      paidAt: z.date(),
    })
    .nullable(),
  settlementAmount: z.number(),
  remainingAfterSettlement: z.number(),
});
export type DepositInfoResponse = z.infer<
  typeof DepositInfoResponseSchema
>;

export const DepositSettlementResponseSchema = z.object({
  invoice: z.object({
    id: z.string().uuid(),
    status: z.string(),
    balance: z.number(),
  }),
  settlement: z.object({
    amount: z.number(),
    journalId: z.string().uuid(),
    depositPaymentId: z.string().uuid(),
  }),
});
export type DepositSettlementResponse = z.infer<
  typeof DepositSettlementResponseSchema
>;
