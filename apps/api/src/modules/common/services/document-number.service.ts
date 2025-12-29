import { prisma, SequenceType } from '@sync-erp/database';

export const DocumentType = SequenceType;
export type DocumentType = SequenceType;

interface DocumentNumberConfig {
  prefix: string;
  separator: string;
  includeYear: boolean;
  // eslint-disable-next-line @sync-erp/no-hardcoded-enum
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
  SHP: {
    prefix: 'SHP',
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
  DN: {
    prefix: 'DN',
    separator: '-',
    includeYear: true,
    yearFormat: '4',
    sequenceLength: 5,
  },
};

export class DocumentNumberService {
  /**
   * Generate a new document number
   * FR-030 to FR-034: Format PREFIX-YYYYMM-00001 (e.g., PO-202412-00001)
   * Sequence resets at the start of each month.
   *
   * Uses atomic upsert for ALL document types to prevent race conditions.
   */
  async generate(
    companyId: string,
    docType: DocumentType
  ): Promise<string> {
    const config = DEFAULT_CONFIGS[docType];
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12

    // FR-030 to FR-034: YYYYMM format (e.g., 202412)
    const yearMonthStr = `${year}${String(month).padStart(2, '0')}`;

    // All SequenceType values use atomic upsert
    // This prevents race conditions when generating concurrent documents
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
    const sequence = seq.lastSequence;

    const sequenceStr = String(sequence).padStart(
      config.sequenceLength,
      '0'
    );

    // Build the document number: PREFIX-YYYYMM-NNNNN
    if (config.includeYear) {
      return `${config.prefix}${config.separator}${yearMonthStr}${config.separator}${sequenceStr}`;
    }
    return `${config.prefix}${config.separator}${sequenceStr}`;
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
