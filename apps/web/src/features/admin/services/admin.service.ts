import api from '../../../services/api';
import { ensureArray } from '../../../utils/safeData';

/**
 * Saga log entry for admin observability.
 */
export interface SagaLog {
  id: string;
  sagaType: string;
  entityId: string;
  step: string;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Orphan journal entry for admin observability.
 */
export interface OrphanJournal {
  id: string;
  date: string;
  sourceType: string | null;
  sourceId: string | null;
  memo: string | null;
  lines: Array<{ debit: number; credit: number }>;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * Admin Service - fetches observability data for admin dashboard.
 * Part of Phase 1 Admin Observability (US5).
 */
export const adminService = {
  /**
   * Fetch saga logs with optional step filter.
   * Returns failed, compensated, or compensation-failed sagas.
   */
  async getSagaLogs(params?: {
    step?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<SagaLog>> {
    const response = await api.get<{
      success: boolean;
      data: SagaLog[];
      pagination: PaginatedResponse<SagaLog>['pagination'];
    }>('/admin/saga-logs', { params });

    return {
      data: ensureArray(response.data.data),
      pagination: response.data.pagination || {
        total: 0,
        limit: 50,
        offset: 0,
      },
    };
  },

  /**
   * Fetch orphan journal entries.
   * Returns entries with missing or invalid source references.
   */
  async getOrphanJournals(params?: {
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<OrphanJournal>> {
    const response = await api.get<{
      success: boolean;
      data: OrphanJournal[];
      pagination: PaginatedResponse<OrphanJournal>['pagination'];
    }>('/admin/journals/orphans', { params });

    return {
      data: ensureArray(response.data.data),
      pagination: response.data.pagination || {
        total: 0,
        limit: 50,
        offset: 0,
      },
    };
  },
};
