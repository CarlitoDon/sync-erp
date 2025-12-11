export type PartnerType = 'CUSTOMER' | 'SUPPLIER';

export interface Partner {
  id: string;
  companyId: string;
  type: PartnerType;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreatePartnerDto {
  name: string;
  type: PartnerType;
  email?: string;
  phone?: string;
  address?: string;
}
