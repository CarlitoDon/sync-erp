export interface SagaLog {
  id: string;
  sagaType: string;
  entityId: string;
  step: string;
  error: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface OrphanJournal {
  id: string;
  date: string | Date;
  sourceType: string | null;
  sourceId: string | null;
  memo: string | null;
  lines: Array<{ debit: number; credit: number }>;
}
