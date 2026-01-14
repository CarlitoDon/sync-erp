/**
 * TRPC Types Export for Public Rental API
 *
 * Type definitions for external TRPC clients (erp-sync-service).
 * Used for type-safe API calls to sync-erp publicRental endpoints.
 *
 * Note: Prefixed with "PublicRental" to avoid naming conflicts with existing validators.
 */
import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import superjson from 'superjson';

// Initialize TRPC with superjson transformer for type inference
const t = initTRPC.create({
  transformer: superjson,
});

// ============================================
// Input Schemas (prefixed to avoid conflicts)
// ============================================

export const PublicRentalFindOrCreatePartnerInput = z.object({
  companyId: z.string().min(1),
  name: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email().optional(),
  address: z.string().optional(),
  street: z.string().optional(),
  kelurahan: z.string().optional(),
  kecamatan: z.string().optional(),
  kota: z.string().optional(),
  provinsi: z.string().optional(),
  zip: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export const PublicRentalCreateOrderInput = z.object({
  companyId: z.string().min(1),
  partnerId: z.string().min(1),
  rentalStartDate: z.coerce.date(),
  rentalEndDate: z.coerce.date(),
  items: z.array(
    z
      .object({
        rentalItemId: z.string().min(1).optional(),
        rentalBundleId: z.string().min(1).optional(),
        quantity: z.number().int().positive(),
        name: z.string().optional(),
        pricePerDay: z.number().positive().optional(),
        category: z
          .enum(['package', 'mattress', 'accessory'])
          .optional(),
        components: z.array(z.string()).optional(),
      })
      .refine(
        (data) => !!data.rentalItemId || !!data.rentalBundleId,
        {
          message:
            'Either rentalItemId or rentalBundleId is required',
        }
      )
  ),
  notes: z.string().optional(),
  deliveryFee: z.number().nonnegative().optional(),
  deliveryAddress: z.string().optional(),
  street: z.string().optional(),
  kelurahan: z.string().optional(),
  kecamatan: z.string().optional(),
  kota: z.string().optional(),
  provinsi: z.string().optional(),
  zip: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  paymentMethod: z.string().optional(),
  discountAmount: z.number().nonnegative().optional(),
  discountLabel: z.string().optional(),
});

export const PublicRentalGetByTokenInput = z.object({
  token: z.string().uuid(),
});

export const PublicRentalConfirmPaymentInput = z.object({
  token: z.string().uuid(),
  paymentMethod: z.enum(['qris', 'transfer']),
  reference: z.string().optional(),
});

// ============================================
// Output Types
// ============================================

export interface PublicRentalPartnerOutput {
  id: string;
  companyId: string;
  type: string;
  name: string;
  email: string | null;
  phone: string;
  address: string | null;
  street: string | null;
  kelurahan: string | null;
  kecamatan: string | null;
  kota: string | null;
  provinsi: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicRentalOrderOutput {
  id: string;
  orderNumber: string;
  publicToken: string | null;
  status: string;
  createdAt: Date;
}

export interface PublicRentalOrderByTokenOutput {
  orderNumber: string;
  status: string;
  rentalStartDate: Date;
  rentalEndDate: Date;
  subtotal: number;
  totalAmount: number;
  depositAmount: number;
  notes: string | null;
  createdAt: Date;
  deliveryFee: number | null;
  deliveryAddress: string | null;
  street: string | null;
  kelurahan: string | null;
  kecamatan: string | null;
  kota: string | null;
  provinsi: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  paymentMethod: string | null;
  discountAmount: number | null;
  discountLabel: string | null;
  orderSource: string | null;
  rentalPaymentStatus: string;
  paymentClaimedAt: Date | null;
  paymentConfirmedAt: Date | null;
  paymentReference: string | null;
  paymentFailedAt: Date | null;
  paymentFailReason: string | null;
  partner: {
    name: string;
    phone: string | null;
    address: string | null;
    street: string | null;
    kelurahan: string | null;
    kecamatan: string | null;
    kota: string | null;
    provinsi: string | null;
    zip: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
}

export interface PublicRentalConfirmPaymentOutput {
  success: boolean;
  orderNumber: string;
  rentalPaymentStatus: string;
  paymentClaimedAt: Date | null;
}

// ============================================
// Router Type Definition (for inference only)
// ============================================

export const publicRentalRouter = t.router({
  getByToken: t.procedure
    .input(PublicRentalGetByTokenInput)
    .query((): PublicRentalOrderByTokenOutput => {
      throw new Error('Type-only');
    }),

  findOrCreatePartner: t.procedure
    .input(PublicRentalFindOrCreatePartnerInput)
    .mutation((): PublicRentalPartnerOutput => {
      throw new Error('Type-only');
    }),

  createOrder: t.procedure
    .input(PublicRentalCreateOrderInput)
    .mutation((): PublicRentalOrderOutput => {
      throw new Error('Type-only');
    }),

  confirmPayment: t.procedure
    .input(PublicRentalConfirmPaymentInput)
    .mutation((): PublicRentalConfirmPaymentOutput => {
      throw new Error('Type-only');
    }),
});

// Export the router type for client usage
export type PublicRentalRouter = typeof publicRentalRouter;

// Infer input/output types from schemas
export type PublicRentalFindOrCreatePartnerInputType = z.infer<
  typeof PublicRentalFindOrCreatePartnerInput
>;
export type PublicRentalCreateOrderInputType = z.infer<
  typeof PublicRentalCreateOrderInput
>;
export type PublicRentalGetByTokenInputType = z.infer<
  typeof PublicRentalGetByTokenInput
>;
export type PublicRentalConfirmPaymentInputType = z.infer<
  typeof PublicRentalConfirmPaymentInput
>;
