import { prisma, SagaStep } from '@sync-erp/database';

interface FindSagaLogsParams {
  companyId: string;
  step?: string;
  limit: number;
  offset: number;
}

interface CountSagaLogsParams {
  companyId: string;
  step?: string;
}

interface FindOrphanJournalsParams {
  companyId: string;
  limit: number;
  offset: number;
}

interface CountOrphanJournalsParams {
  companyId: string;
}

/**
 * Admin Repository - Data access for admin observability queries.
 * Part of Phase 1 Admin Observability (US5).
 */
export class AdminRepository {
  /**
   * Find saga logs with optional step filter.
   * Returns failed, compensated, or compensation-failed sagas.
   */
  async findSagaLogs(params: FindSagaLogsParams) {
    const { companyId, step, limit, offset } = params;

    // Build step filter - if not specified, show all failure states
    const stepFilter = step
      ? { step: step as SagaStep }
      : {
          step: {
            in: [SagaStep.FAILED, SagaStep.COMPENSATION_FAILED],
          },
        };

    return prisma.sagaLog.findMany({
      where: {
        companyId,
        ...stepFilter,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        sagaType: true,
        entityId: true,
        step: true,
        error: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Count saga logs matching filter criteria.
   */
  async countSagaLogs(params: CountSagaLogsParams): Promise<number> {
    const { companyId, step } = params;

    const stepFilter = step
      ? { step: step as SagaStep }
      : {
          step: {
            in: [SagaStep.FAILED, SagaStep.COMPENSATION_FAILED],
          },
        };

    return prisma.sagaLog.count({
      where: {
        companyId,
        ...stepFilter,
      },
    });
  }

  /**
   * Find journal entries with missing or invalid source references.
   * These are entries without proper traceability.
   */
  async findOrphanJournals(params: FindOrphanJournalsParams) {
    const { companyId, limit, offset } = params;

    return prisma.journalEntry.findMany({
      where: {
        companyId,
        OR: [{ sourceType: null }, { sourceId: null }],
      },
      orderBy: { date: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        date: true,
        sourceType: true,
        sourceId: true,
        memo: true,
        lines: {
          select: {
            debit: true,
            credit: true,
          },
        },
      },
    });
  }

  /**
   * Count orphan journal entries.
   */
  async countOrphanJournals(
    params: CountOrphanJournalsParams
  ): Promise<number> {
    const { companyId } = params;

    return prisma.journalEntry.count({
      where: {
        companyId,
        OR: [{ sourceType: null }, { sourceId: null }],
      },
    });
  }
}
