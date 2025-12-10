import { prisma } from '@sync-erp/database';

type DocumentType = 'PO' | 'SO' | 'INV' | 'BILL' | 'JE';

interface DocumentNumberConfig {
  prefix: string;
  separator: string;
  includeYear: boolean;
  yearFormat: '2' | '4'; // YY or YYYY
  sequenceLength: number;
}

const DEFAULT_CONFIGS: Record<DocumentType, DocumentNumberConfig> = {
  PO: { prefix: 'PO', separator: '-', includeYear: true, yearFormat: '4', sequenceLength: 5 },
  SO: { prefix: 'SO', separator: '-', includeYear: true, yearFormat: '4', sequenceLength: 5 },
  INV: { prefix: 'INV', separator: '-', includeYear: true, yearFormat: '4', sequenceLength: 5 },
  BILL: { prefix: 'BILL', separator: '-', includeYear: true, yearFormat: '4', sequenceLength: 5 },
  JE: { prefix: 'JE', separator: '-', includeYear: true, yearFormat: '4', sequenceLength: 5 },
};

export class DocumentNumberService {
  /**
   * Generate a new document number
   * Format: PREFIX-YYYY-00001 or PREFIX-YY-00001
   */
  async generate(companyId: string, docType: DocumentType): Promise<string> {
    const config = DEFAULT_CONFIGS[docType];
    const year = new Date().getFullYear();
    const yearStr = config.yearFormat === '4' ? year.toString() : year.toString().slice(-2);

    // Get current sequence count for this company/type/year
    const count = await this.getSequenceCount(companyId, docType, year);
    const sequence = String(count + 1).padStart(config.sequenceLength, '0');

    // Increment the sequence
    await this.incrementSequence(companyId, docType, year);

    // Build the document number
    if (config.includeYear) {
      return `${config.prefix}${config.separator}${yearStr}${config.separator}${sequence}`;
    }
    return `${config.prefix}${config.separator}${sequence}`;
  }

  /**
   * Get current sequence count for a document type in a given year
   */
  private async getSequenceCount(
    companyId: string,
    docType: DocumentType,
    year: number
  ): Promise<number> {
    // Use raw query to get or create sequence counter
    // For simplicity, we'll count existing documents of that type for this year
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);

    switch (docType) {
      case 'PO':
      case 'SO':
        return prisma.order.count({
          where: {
            companyId,
            type: docType === 'PO' ? 'PURCHASE' : 'SALES',
            createdAt: { gte: yearStart, lt: yearEnd },
          },
        });

      case 'INV':
        return prisma.invoice.count({
          where: {
            companyId,
            type: 'INVOICE',
            createdAt: { gte: yearStart, lt: yearEnd },
          },
        });

      case 'BILL':
        return prisma.invoice.count({
          where: {
            companyId,
            type: 'BILL',
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
   * Increment sequence (no-op for count-based implementation)
   */
  private async incrementSequence(
    _companyId: string,
    _docType: DocumentType,
    _year: number
  ): Promise<void> {
    // Using count-based approach, no explicit sequence table needed
    // If needed for better performance, implement a Sequence table
  }

  /**
   * Parse a document number to extract components
   */
  parse(docNumber: string): { prefix: string; year?: string; sequence: string } | null {
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
