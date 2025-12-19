import { prisma, SequenceType } from '@sync-erp/database';

export type DocumentType =
  | 'PO'
  | 'SO'
  | 'INV'
  | 'BILL'
  | 'JE'
  | 'CN'
  | 'GRN'
  | 'PAY';

interface DocumentNumberConfig {
  prefix: string;
  separator: string;
  includeYear: boolean;
  yearFormat: '2' | '4'; // YY or YYYY
  sequenceLength: number;
}

const DEFAULT_CONFIGS: Record<DocumentType, DocumentNumberConfig> = {
  PO: {
    prefix: 'PO',
    separator: '-',
    includeYear: true,
    yearFormat: '4',
    sequenceLength: 5,
  },
  GRN: {
    prefix: 'GRN',
    separator: '-',
    includeYear: true,
    yearFormat: '4',
    sequenceLength: 5,
  },
  SO: {
    prefix: 'SO',
    separator: '-',
    includeYear: true,
    yearFormat: '4',
    sequenceLength: 5,
  },
  INV: {
    prefix: 'INV',
    separator: '-',
    includeYear: true,
    yearFormat: '4',
    sequenceLength: 5,
  },
  BILL: {
    prefix: 'BILL',
    separator: '-',
    includeYear: true,
    yearFormat: '4',
    sequenceLength: 5,
  },
  PAY: {
    prefix: 'PAY',
    separator: '-',
    includeYear: true,
    yearFormat: '4',
    sequenceLength: 5,
  },
  JE: {
    prefix: 'JE',
    separator: '-',
    includeYear: true,
    yearFormat: '4',
    sequenceLength: 5,
  },
  CN: {
    prefix: 'CN',
    separator: '-',
    includeYear: true,
    yearFormat: '4',
    sequenceLength: 5,
  },
};

export class DocumentNumberService {
  /**
   * Generate a new document number
   * Format: PREFIX-YYYY-00001 or PREFIX-YY-00001
   */
  async generate(
    companyId: string,
    docType: DocumentType
  ): Promise<string> {
    const config = DEFAULT_CONFIGS[docType];
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12

    // YY or YYYY string
    const yearStr =
      config.yearFormat === '4'
        ? year.toString()
        : year.toString().slice(-2);

    let sequence = 0;

    // Supported types for atomic increment: PO, GRN, BILL, PAY
    // We strictly check against the SequenceType values to ensure type safety
    if (
      docType === SequenceType.PO ||
      docType === SequenceType.GRN ||
      docType === SequenceType.BILL ||
      docType === SequenceType.PAY
    ) {
      // Safe to cast because we verified it matches one of the SequenceType enum values
      const type = docType as SequenceType;

      const seq = await prisma.documentSequence.upsert({
        where: {
          companyId_type_year_month: {
            companyId,
            type,
            year,
            month,
          },
        },
        create: {
          companyId,
          type,
          year,
          month,
          lastSequence: 1,
        },
        update: {
          lastSequence: { increment: 1 },
        },
      });
      sequence = seq.lastSequence;
    } else {
      // Fallback for types not yet in SequenceType enum (SO, INV, etc.)
      // This maintains backward compatibility until we migrate Sales/Finance to new sequence
      sequence =
        (await this.getSequenceCount(companyId, docType, year)) + 1;
    }

    const sequenceStr = String(sequence).padStart(
      config.sequenceLength,
      '0'
    );

    // Build the document number
    if (config.includeYear) {
      return `${config.prefix}${config.separator}${yearStr}${config.separator}${sequenceStr}`;
    }
    return `${config.prefix}${config.separator}${sequenceStr}`;
  }

  /**
   * Get current sequence count for a document type in a given year
   */
  private async getSequenceCount(
    companyId: string,
    docType: DocumentType,
    year: number
  ): Promise<number> {
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);

    switch (docType) {
      case 'SO':
        return prisma.order.count({
          where: {
            companyId,
            type: 'SALES',
            createdAt: { gte: yearStart, lt: yearEnd },
          },
        });

      case 'INV':
        return prisma.invoice.count({
          where: {
            companyId,
            type: 'INVOICE', // Sales Invoice
            createdAt: { gte: yearStart, lt: yearEnd },
          },
        });

      case 'CN':
        return prisma.invoice.count({
          where: {
            companyId,
            type: { in: ['CREDIT_NOTE'] }, // Ensure correct enum usage
            createdAt: { gte: yearStart, lt: yearEnd },
          },
        });

      case 'JE':
        return prisma.journalEntry.count({
          where: {
            companyId,
            createdAt: { gte: yearStart, lt: yearEnd },
          },
        });

      default:
        return 0;
    }
  }

  /**
   * Parse a document number to extract components
   */
  parse(
    docNumber: string
  ): { prefix: string; year?: string; sequence: string } | null {
    const parts = docNumber.split('-');
    if (parts.length === 3) {
      return { prefix: parts[0], year: parts[1], sequence: parts[2] };
    }
    if (parts.length === 2) {
      return { prefix: parts[0], sequence: parts[1] };
    }
    return null;
  }
}
