import { z } from 'zod';
import { AddressSchema } from '../generated/zod/index.js';

export { AddressSchema };
export type { Address } from '../generated/zod/index.js';

export const CreateAddressInputSchema = z.object({
  partnerId: z.string().uuid(),
  name: z.string().optional(),
  isDefault: z.boolean().optional().default(false),
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

export type CreateAddressInput = z.infer<typeof CreateAddressInputSchema>;

export const UpdateAddressInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().optional(),
  isDefault: z.boolean().optional(),
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

export type UpdateAddressInput = z.infer<typeof UpdateAddressInputSchema>;

export const AddressListQuerySchema = z.object({
  partnerId: z.string().uuid(),
});

export type AddressListQuery = z.infer<typeof AddressListQuerySchema>;
