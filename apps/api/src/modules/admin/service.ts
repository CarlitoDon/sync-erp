import { AdminRepository } from './repository';
import { SagaLog, OrphanJournal } from '@sync-erp/shared';

export interface PaginatedResult<T> {
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
  ): Promise<PaginatedResult<SagaLog>> {
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
      data: data as SagaLog[], // Cast repository result
      pagination: { total, limit, offset },
    };
  }

  /**
   * Get journal entries with missing or invalid source references.
   * These are "orphan" entries that can't be traced to a source document.
   */
  async getOrphanJournals(
    params: GetOrphanJournalsParams
  ): Promise<PaginatedResult<OrphanJournal>> {
    const { companyId, limit, offset } = params;

    const [data, total] = await Promise.all([
      this.repository.findOrphanJournals({
        companyId,
        limit,
        offset,
      }),
      this.repository.countOrphanJournals({ companyId }),
    ]);

    const mappedData = data.map((journal: any) => ({
      ...journal,
      lines: journal.lines.map((line: any) => ({
        ...line,
        debit: line.debit.toNumber(),
        credit: line.credit.toNumber(),
      })),
    }));

    return {
      data: mappedData,
      pagination: { total, limit, offset },
    };
  }
}
