import {
  Partner,
  PartnerTypeType, // Use original name to avoid conflict with local const
  PartnerTypeSchema,
} from '../generated/zod/index.js';

export const PartnerType = PartnerTypeSchema.enum;
export type PartnerType = PartnerTypeType;

export type { Partner };

export interface CreatePartnerDto {
  name: string;
  type: PartnerType;
  email?: string;
  phone?: string;
  address?: string;
}
