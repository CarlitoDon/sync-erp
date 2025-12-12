import api from '../../../services/api';
import type {
  Company,
  CreateCompanyDto,
  JoinCompanyDto,
  ApiResponse,
} from '@sync-erp/shared';

export async function getCompanies(): Promise<Company[]> {
  const response =
    await api.get<ApiResponse<Company[]>>('/companies');
  return response.data.data || [];
}

export async function getCompanyById(
  id: string
): Promise<Company | null> {
  const response = await api.get<ApiResponse<Company>>(
    `/companies/${id}`
  );
  return response.data.data || null;
}

export async function createCompany(
  data: CreateCompanyDto
): Promise<Company> {
  const response = await api.post<ApiResponse<Company>>(
    '/companies',
    data
  );
  if (!response.data.data) {
    throw new Error('Failed to create company');
  }
  return response.data.data;
}

export async function joinCompany(
  data: JoinCompanyDto
): Promise<Company> {
  const response = await api.post<ApiResponse<Company>>(
    '/companies/join',
    data
  );
  if (!response.data.data) {
    throw new Error('Failed to join company');
  }
  return response.data.data;
}
