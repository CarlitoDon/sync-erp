/**
 * Journal Core Service
 *
 * Handles core journal entry creation, reversal, retrieval, and account validation.
 * Used by domain-specific journal services.
 */

import {
  JournalEntry,
  JournalSourceType,
  Prisma,
} from '@sync-erp/database';
import {
  BusinessDate,
  DomainError,
  DomainErrorCodes,
  JournalLine,
} from '@sync-erp/shared';
import { JournalRepository } from '../repositories/journal.repository';
import { AccountService } from './account.service';

export interface CreateJournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
}

export interface CreateJournalEntryInput {
  date?: string | Date;
  reference?: string;
  memo?: string;
  sourceType?: JournalSourceType;
  sourceId?: string;
  lines: CreateJournalLineInput[];
}

export class JournalCoreService {
  constructor(
    private readonly repository: JournalRepository = new JournalRepository(),
    private readonly accountService: AccountService = new AccountService()
  ) {}

  async reverse(
    companyId: string,
    journalId: string,
    reason?: string,
    tx?: Prisma.TransactionClient
  ): Promise<JournalEntry> {
    const original = await this.repository.findById(
      journalId,
      companyId,
      tx
    );
    if (!original) {
      throw new DomainError(
        'Journal entry not found',
        404,
        DomainErrorCodes.NOT_FOUND
      );
    }

    const reversalLines: CreateJournalLineInput[] =
      original.lines.map((line: JournalLine) => ({
        accountId: line.accountId,
        debit: Number(line.credit), // Swap
        credit: Number(line.debit), // Swap
      }));

    return this.create(
      companyId,
      {
        date: new Date(),
        reference: `Reversal: ${original.reference || journalId}`,
        memo: reason || `Reversal of journal ${journalId}`,
        lines: reversalLines,
      },
      tx
    );
  }

  async create(
    companyId: string,
    data: CreateJournalEntryInput,
    tx?: Prisma.TransactionClient
  ): Promise<JournalEntry> {
    // Validate: debits must equal credits
    const totalDebit = data.lines.reduce(
      (sum, l) => sum + (l.debit || 0),
      0
    );
    const totalCredit = data.lines.reduce(
      (sum, l) => sum + (l.credit || 0),
      0
    );

    // Allow small floating point error
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new DomainError(
        `Journal entry is unbalanced. Debits: ${totalDebit}, Credits: ${totalCredit}`,
        400,
        DomainErrorCodes.OPERATION_NOT_ALLOWED
      );
    }

    // Verify accounts exist and prepare lines
    const lineData: Prisma.JournalLineUncheckedCreateWithoutJournalInput[] =
      [];
    for (const line of data.lines) {
      let account;
      if (tx) {
        account = await tx.account.findUnique({
          where: { id: line.accountId },
        });
        if (account && account.companyId !== companyId)
          account = null;
      } else {
        account = await this.accountService.getById(
          line.accountId,
          companyId
        );
      }

      if (!account) {
        throw new DomainError(
          `Account not found: ${line.accountId}`,
          404,
          DomainErrorCodes.NOT_FOUND
        );
      }
      lineData.push({
        accountId: account.id,
        debit: line.debit || 0,
        credit: line.credit || 0,
      });
    }

    const journalDate = data.date ? new Date(data.date) : new Date();

    // Phase 1 Guard: Backdated check
    BusinessDate.from(journalDate).ensureNotBackdated();

    const createData: Prisma.JournalEntryUncheckedCreateInput = {
      companyId,
      reference: data.reference,
      date: journalDate,
      memo: data.memo,
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      lines: {
        create: lineData,
      },
    };

    return this.repository.create(createData, tx);
  }

  async getById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient
  ) {
    return this.repository.findById(id, companyId, tx);
  }

  async list(
    companyId: string,
    startDate?: Date,
    endDate?: Date,
    tx?: Prisma.TransactionClient
  ) {
    return this.repository.findAll(companyId, startDate, endDate, tx);
  }

  async getAccountBalance(
    accountId: string,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const sums = await this.repository.aggregateAccountSum(
      accountId,
      undefined,
      tx
    );
    return (
      (Number(sums._sum.debit) || 0) - (Number(sums._sum.credit) || 0)
    );
  }

  public async resolveAndCreate(
    companyId: string,
    data: {
      reference: string;
      memo: string;
      date?: Date;
      sourceType?: JournalSourceType;
      sourceId?: string;
      lines: {
        accountCode: string;
        debit?: number;
        credit?: number;
      }[];
    },
    tx?: Prisma.TransactionClient
  ) {
    const resolvedLines: CreateJournalLineInput[] = [];
    for (const line of data.lines) {
      let acc;
      if (tx) {
        acc = await tx.account.findUnique({
          where: {
            companyId_code: { companyId, code: line.accountCode },
          },
        });
      } else {
        acc = await this.accountService.getByCode(
          companyId,
          line.accountCode
        );
      }

      if (!acc) {
        throw new DomainError(
          `System Account code ${line.accountCode} not found. Please seed defaults.`,
          404,
          DomainErrorCodes.NOT_FOUND
        );
      }
      resolvedLines.push({
        accountId: acc.id,
        debit: line.debit || 0,
        credit: line.credit || 0,
      });
    }

    return this.create(
      companyId,
      {
        date: data.date,
        reference: data.reference,
        memo: data.memo,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        lines: resolvedLines,
      },
      tx
    );
  }
}
