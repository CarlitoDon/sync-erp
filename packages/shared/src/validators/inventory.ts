import { z } from 'zod';

// ==========================================
// Goods Receipt (GRN)
// ==========================================

const GoodsReceiptInputItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
});

export const CreateGoodsReceiptSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  date: z.string().datetime().optional(), // ISO string
  notes: z.string().optional(),
  items: z.array(GoodsReceiptInputItemSchema).min(1),
});

export const POST_GoodsReceiptSchema = z.object({
  // No body needed for posting, usually just ID in param
});

// ==========================================
// Shipment (Delivery Note)
// ==========================================

const ShipmentInputItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
});

export const CreateShipmentSchema = z.object({
  salesOrderId: z.string().uuid(),
  date: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z.array(ShipmentInputItemSchema).min(1),
});

export const POST_ShipmentSchema = z.object({
  // No body
});

// ==========================================
// Input Types (from Zod schemas)
// ==========================================

export type CreateGoodsReceiptInput = z.infer<
  typeof CreateGoodsReceiptSchema
>;
export type CreateShipmentInput = z.infer<
  typeof CreateShipmentSchema
>;

// ==========================================
// API Response Types
// ==========================================

export interface GoodsReceiptItemResponse {
  id: string;
  productId: string;
  quantity: number;
  unitCost?: number;
  product?: { name: string; sku?: string };
}

export interface GoodsReceiptResponse {
  id: string;
  companyId: string;
  purchaseOrderId: string;
  number: string;
  date: string;
  status: 'DRAFT' | 'POSTED';
  notes?: string;
  items: GoodsReceiptItemResponse[];
  purchaseOrder?: { orderNumber: string };
  createdAt: string;
}

export interface ShipmentItemResponse {
  id: string;
  productId: string;
  quantity: number;
  costSnapshot?: number;
  product?: { name: string; sku?: string };
}

export interface ShipmentResponse {
  id: string;
  companyId: string;
  salesOrderId: string;
  number: string;
  date: string;
  status: 'DRAFT' | 'POSTED';
  notes?: string;
  items: ShipmentItemResponse[];
  salesOrder?: { orderNumber: string };
  createdAt: string;
}
