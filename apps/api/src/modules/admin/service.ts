import { AdminRepository } from './repository';

interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

interface GetSagaLogsParams {
  companyId: string;
  step?: string;
  limit: number;
  offset: number;
}

interface GetOrphanJournalsParams {
  companyId: string;
  limit: number;
  offset: number;
}

/**
 * Admin Service - Business logic for admin observability.
 * Part of Phase 1 Admin Observability (US5).
 */
export class AdminService {
  private repository: AdminRepository;

  constructor() {
    this.repository = new AdminRepository();
  }

  /**
   * Get saga logs filtered by step (FAILED, COMPENSATED, COMPENSATION_FAILED).
   */
  async getSagaLogs(
    params: GetSagaLogsParams
  ): Promise<PaginatedResult<unknown>> {
    const { companyId, step, limit, offset } = params;

    const [data, total] = await Promise.all([
      this.repository.findSagaLogs({
        companyId,
        step,
        limit,
        offset,
      }),
      this.repository.countSagaLogs({ companyId, step }),
    ]);

    return {
      data,
      pagination: { total, limit, offset },
    };
  }

  /**
   * Get journal entries with missing or invalid source references.
   * These are "orphan" entries that can't be traced to a source document.
   */
  async getOrphanJournals(
    params: GetOrphanJournalsParams
  ): Promise<PaginatedResult<unknown>> {
    const { companyId, limit, offset } = params;

    const [data, total] = await Promise.all([
      this.repository.findOrphanJournals({
        companyId,
        limit,
        offset,
      }),
      this.repository.countOrphanJournals({ companyId }),
    ]);

    return {
      data,
      pagination: { total, limit, offset },
    };
  }
}
