import api from './api';

export interface Partner {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  type: 'CUSTOMER' | 'SUPPLIER';
  createdAt: string;
}

export interface CreatePartnerInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  type: 'CUSTOMER' | 'SUPPLIER';
}

export const partnerService = {
  async list(type?: 'CUSTOMER' | 'SUPPLIER'): Promise<Partner[]> {
    const params = type ? { type } : {};
    const res = await api.get('/partners', { params });
    return res.data.data;
  },

  async listSuppliers(): Promise<Partner[]> {
    const res = await api.get('/partners/suppliers');
    return res.data.data;
  },

  async listCustomers(): Promise<Partner[]> {
    const res = await api.get('/partners/customers');
    return res.data.data;
  },

  async getById(id: string): Promise<Partner> {
    const res = await api.get(`/partners/${id}`);
    return res.data.data;
  },

  async create(data: CreatePartnerInput): Promise<Partner> {
    const res = await api.post('/partners', data);
    return res.data.data;
  },

  async update(
    id: string,
    data: Partial<CreatePartnerInput>
  ): Promise<Partner> {
    const res = await api.put(`/partners/${id}`, data);
    return res.data.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/partners/${id}`);
  },
};
