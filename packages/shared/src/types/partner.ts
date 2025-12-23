import {
  Partner,
  PartnerTypeType as PartnerType,
} from '../generated/zod/index.js';

export type { Partner, PartnerType };

export interface CreatePartnerDto {
  name: string;
  type: PartnerType;
  email?: string;
  phone?: string;
  address?: string;
}
