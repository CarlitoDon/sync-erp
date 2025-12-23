import { SagaLog } from '../generated/zod/index.js';

export type { SagaLog };

export interface OrphanJournal {
  id: string;
  date: string | Date;
  sourceType: string | null;
  sourceId: string | null;
  memo: string | null;
  lines: Array<{ debit: number; credit: number }>;
}
