import { useCallback } from 'react';
import { useCompanyData } from '@/hooks/useCompanyData';
import { apiAction } from '@/hooks/useApiAction';
import { useCompany } from '@/contexts/CompanyContext';
import api from '@/services/api';
import { Invoice } from '@sync-erp/shared'; // Using shared types (Invoice is mirrored from DB)

// Input interfaces matching API expectations
export interface CreateBillInput {
  orderId: string;
  invoiceNumber?: string;
  dueDate?: Date;
  taxRate?: number;
  businessDate?: Date;
  paymentTermsString?: string;
}

export interface UseBillOptions {
  filters?: { status?: string };
}

export interface UseBillReturn {
  bills: Invoice[];
  loading: boolean;
  refresh: () => Promise<void>;
  createFromPO: (
    data: CreateBillInput
  ) => Promise<Invoice | undefined>;
  postBill: (id: string) => Promise<Invoice | undefined>;
  voidBill: (id: string) => Promise<Invoice | undefined>;
  getBill: (id: string) => Promise<Invoice | undefined>;
}

export function useBill(options: UseBillOptions = {}): UseBillReturn {
  const { currentCompany } = useCompany();

  // List fetcher
  const fetchBills = useCallback(
    async (companyId: string) => {
      const response = await api.get<{ data: Invoice[] }>(
        '/api/bills',
        {
          headers: { 'x-company-id': companyId },
          params: options.filters,
        }
      );
      return response.data.data;
    },
    [JSON.stringify(options.filters)]
  );

  const {
    data: bills,
    loading,
    refresh,
  } = useCompanyData<Invoice[]>(fetchBills, []);

  const createFromPO = useCallback(
    async (data: CreateBillInput) => {
      if (!currentCompany?.id) return undefined;

      const result = await apiAction(async () => {
        const response = await api.post<{ data: Invoice }>(
          '/api/bills',
          data,
          { headers: { 'x-company-id': currentCompany.id } }
        );
        return response.data.data;
      }, 'Bill created successfully!');

      if (result) refresh();
      return result;
    },
    [currentCompany?.id, refresh]
  );

  const postBill = useCallback(
    async (id: string) => {
      if (!currentCompany?.id) return undefined;

      const result = await apiAction(async () => {
        const response = await api.post<{ data: Invoice }>(
          `/api/bills/${id}/post`,
          {},
          { headers: { 'x-company-id': currentCompany.id } }
        );
        return response.data.data;
      }, 'Bill posted successfully!');

      if (result) refresh();
      return result;
    },
    [currentCompany?.id, refresh]
  );

  const voidBill = useCallback(
    async (id: string) => {
      if (!currentCompany?.id) return undefined;

      const result = await apiAction(async () => {
        const response = await api.post<{ data: Invoice }>(
          `/api/bills/${id}/void`,
          {},
          { headers: { 'x-company-id': currentCompany.id } }
        );
        return response.data.data;
      }, 'Bill voided successfully!');

      if (result) refresh();
      return result;
    },
    [currentCompany?.id, refresh]
  );

  const getBill = useCallback(
    async (id: string) => {
      if (!currentCompany?.id) return undefined;
      const response = await api.get<{ data: Invoice }>(
        `/api/bills/${id}`,
        { headers: { 'x-company-id': currentCompany.id } }
      );
      return response.data.data;
    },
    [currentCompany?.id]
  );

  return {
    bills,
    loading,
    refresh,
    createFromPO,
    postBill,
    voidBill,
    getBill,
  };
}

export default useBill;
