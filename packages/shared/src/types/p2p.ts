import type { OrderItem } from '../generated/zod/index.js';

// Re-export OrderStatus for convenience
export type {
  OrderStatusType as OrderStatus,
  OrderTypeType as OrderType,
} from '../generated/zod/index.js';

// Local type alias for use in this file
type PaymentMethod =
  import('../generated/zod/index.js').PaymentMethodTypeType;

export type { InvoiceStatus, InvoiceType } from './finance.js';

// ==========================================
// Purchase Order
// ==========================================

export interface LegacyCreatePurchaseOrderInput {
  partnerId: string;
  date?: Date | string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  paymentTerms?: string;
  notes?: string;
  taxRate?: number;
}

export interface PurchaseOrderLine extends OrderItem {
  // Add specific PO line fields if any
}

// ==========================================
// Goods Receipt (GRN)
// ==========================================

export interface CreateP2PGoodsReceiptInput {
  purchaseOrderId: string;
  date?: Date | string;
  receivedBy: string;
  notes?: string;
  items: Array<{
    purchaseOrderItemId: string;
    quantity: number;
    productId: string; // Redundant but useful for validation
  }>;
}

// ==========================================
// Bill (Supplier Invoice)
// ==========================================

export interface CreateP2PBillInput {
  orderId?: string;
  partnerId: string;
  date: Date | string;
  dueDate: Date | string;
  invoiceNumber?: string; // Auto-generated internal
  supplierInvoiceNumber: string; // Required external ref
  paymentTerms?: string;
  notes?: string;
  items: Array<{
    productId: string; // If direct bill
    grnLineId?: string; // If from GRN
    description?: string;
    quantity: number;
    price: number;
  }>;
  taxRate?: number;
}

// ==========================================
// Payment
// ==========================================

export interface CreateP2PPaymentInput {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  accountId: string; // Bank/Cash Account ID
  reference?: string;
  date: Date | string;
  notes?: string;
}
