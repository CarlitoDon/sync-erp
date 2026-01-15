import { z } from 'zod';

// Order Item Schema
const OrderItemSchema = z.object({
  id: z.string().min(1), // Added for mapping to rentalItemId/BundleId
  name: z.string().min(1),
  category: z.enum(['package', 'mattress', 'accessory']),
  quantity: z.number().int().positive(),
  pricePerDay: z.number().nonnegative(),
});

// Main Order Payload Schema
export const OrderPayloadSchema = z.object({
  orderId: z.string().min(1),
  customerName: z.string().min(2, 'Nama minimal 2 karakter'),
  customerWhatsapp: z.string().min(8, 'Nomor WA minimal 8 digit'),
  deliveryAddress: z.string().min(5, 'Alamat terlalu pendek'),
  addressFields: z
    .object({
      street: z.string().optional(),
      kelurahan: z.string().optional(),
      kecamatan: z.string().optional(),
      kota: z.string().optional(),
      provinsi: z.string().optional(),
      zip: z.string().optional(),
      lat: z.string().optional(),
      lng: z.string().optional(),
    })
    .optional(),
  items: z.array(OrderItemSchema).min(1, 'Minimal 1 barang'),
  totalPrice: z.number().positive(),
  orderDate: z.string(), // ISO date string
  endDate: z.string(), // ISO date string
  duration: z.number().int().positive(),
  deliveryFee: z.number().nonnegative(),
  paymentMethod: z.enum(['qris', 'transfer']).optional(),
  notes: z.string().optional(),
  volumeDiscountAmount: z.number().optional(),
  volumeDiscountLabel: z.string().optional(),
  orderUrl: z.string().url().optional(), // Order tracking page URL
});

export type OrderPayload = z.infer<typeof OrderPayloadSchema>;
export type OrderItem = z.infer<typeof OrderItemSchema>;
