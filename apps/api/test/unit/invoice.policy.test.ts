import { describe, it, expect } from 'vitest';
import { InvoicePolicy } from '@modules/accounting/policies/invoice.policy';
import { Invoice, InvoiceStatus, OrderStatus } from '@sync-erp/database';
import { DomainErrorCodes } from '@sync-erp/shared';
import { Decimal } from 'decimal.js';

describe('InvoicePolicy', () => {
  describe('validateCreate', () => {
    it('should pass with valid business date', () => {
      expect(() =>
        InvoicePolicy.validateCreate({ businessDate: new Date() })
      ).not.toThrow();
    });

    it('should pass without business date', () => {
      expect(() => InvoicePolicy.validateCreate({})).not.toThrow();
    });
  });

  describe('validateUpdate', () => {
    const draftInvoice = {
      id: 'inv-1',
      status: InvoiceStatus.DRAFT,
      invoiceNumber: 'INV-001',
    } as unknown as Invoice;

    const postedInvoice = {
      ...draftInvoice,
      status: InvoiceStatus.POSTED,
    } as unknown as Invoice;

    it('should pass for DRAFT invoice with valid data', () => {
      expect(() =>
        InvoicePolicy.validateUpdate(draftInvoice, {
          memo: 'Updated',
        })
      ).not.toThrow();
    });

    it('should throw if invoice is not DRAFT', () => {
      expect(() =>
        InvoicePolicy.validateUpdate(postedInvoice, {
          memo: 'Updated',
        })
      ).toThrow();
    });

    it('should throw if trying to change invoice number', () => {
      expect(() =>
        InvoicePolicy.validateUpdate(draftInvoice, {
          invoiceNumber: 'INV-002',
        })
      ).toThrow();
    });

    it('should allow same invoice number', () => {
      expect(() =>
        InvoicePolicy.validateUpdate(draftInvoice, {
          invoiceNumber: 'INV-001',
        })
      ).not.toThrow();
    });
  });

  describe('validatePost', () => {
    it('should pass for DRAFT status', () => {
      expect(() =>
        InvoicePolicy.validatePost(InvoiceStatus.DRAFT)
      ).not.toThrow();
    });

    it('should throw for POSTED status', () => {
      expect(() =>
        InvoicePolicy.validatePost(InvoiceStatus.POSTED)
      ).toThrow();
    });

    it('should throw for PAID status', () => {
      expect(() =>
        InvoicePolicy.validatePost(InvoiceStatus.PAID)
      ).toThrow();
    });
  });

  describe('ensureOrderReadyForInvoice', () => {
    it('should pass for CONFIRMED order', () => {
      expect(() =>
        InvoicePolicy.ensureOrderReadyForInvoice({
          status: OrderStatus.CONFIRMED,
        })
      ).not.toThrow();
    });

    it('should pass for SHIPPED order', () => {
      expect(() =>
        InvoicePolicy.ensureOrderReadyForInvoice({
          status: OrderStatus.SHIPPED,
        })
      ).not.toThrow();
    });

    it('should pass for PARTIALLY_SHIPPED order', () => {
      expect(() =>
        InvoicePolicy.ensureOrderReadyForInvoice({
          status: OrderStatus.PARTIALLY_SHIPPED,
        })
      ).not.toThrow();
    });

    it('should pass for COMPLETED order', () => {
      expect(() =>
        InvoicePolicy.ensureOrderReadyForInvoice({
          status: OrderStatus.COMPLETED,
        })
      ).not.toThrow();
    });

    it('should throw for DRAFT order', () => {
      expect(() =>
        InvoicePolicy.ensureOrderReadyForInvoice({
          status: OrderStatus.DRAFT,
        })
      ).toThrow();
    });

    it('should throw for CANCELLED order', () => {
      expect(() =>
        InvoicePolicy.ensureOrderReadyForInvoice({
          status: OrderStatus.CANCELLED,
        })
      ).toThrow();
    });
  });

  describe('ensureShipmentExists', () => {
    it('should pass when shipment count > 0', () => {
      expect(() =>
        InvoicePolicy.ensureShipmentExists(1)
      ).not.toThrow();
    });

    it('should throw when shipment count is 0', () => {
      expect(() => InvoicePolicy.ensureShipmentExists(0)).toThrow();
    });
  });

  describe('validate3WayMatching', () => {
    const validInvoice = {
      amount: new Decimal(1100000),
      subtotal: new Decimal(1000000),
      notes: null,
    };

    const dpInvoice = {
      ...validInvoice,
      notes: 'Down Payment Invoice (30%)',
    };

    const order = {
      items: [
        { productId: 'p1', quantity: 10, price: new Decimal(100000) },
      ],
      totalAmount: new Decimal(1100000),
      dpAmount: null,
      paymentTerms: 'NET30',
    };

    const fullShippedQty = new Map([['p1', 10]]);
    const partialShippedQty = new Map([['p1', 5]]);
    const noShippedQty = new Map<string, number>();

    it('should pass when subtotal and qty match', () => {
      expect(() =>
        InvoicePolicy.validate3WayMatching(
          validInvoice,
          order,
          fullShippedQty
        )
      ).not.toThrow();
    });

    it('should skip validation for DP Invoices', () => {
      expect(() =>
        InvoicePolicy.validate3WayMatching(
          dpInvoice,
          order,
          noShippedQty
        )
      ).not.toThrow();
    });

    it('should skip validation for isDpInvoice=true', () => {
      expect(() =>
        InvoicePolicy.validate3WayMatching(
          validInvoice,
          order,
          noShippedQty,
          true
        )
      ).not.toThrow();
    });

    it('should skip for UPFRONT with no Shipment', () => {
      const upfrontOrder = {
        ...order,
        paymentTerms: 'UPFRONT',
      };
      expect(() =>
        InvoicePolicy.validate3WayMatching(
          validInvoice,
          upfrontOrder,
          noShippedQty
        )
      ).not.toThrow();
    });

    it('should allow partial invoicing when subtotal is less than order', () => {
      // Feature 041: Partial invoicing is allowed (e.g., invoicing per Shipment)
      const partialInvoice = {
        ...validInvoice,
        subtotal: new Decimal(500000), // Half of order subtotal
      };
      expect(() =>
        InvoicePolicy.validate3WayMatching(
          partialInvoice,
          order,
          fullShippedQty
        )
      ).not.toThrow();
    });

    it('should throw on subtotal mismatch when subtotal exceeds order', () => {
      // Only throws when invoice subtotal is >= order subtotal but mismatched
      const overInvoice = {
        ...validInvoice,
        subtotal: new Decimal(1100000), // Exceeds order subtotal (1M)
      };
      try {
        InvoicePolicy.validate3WayMatching(
          overInvoice,
          order,
          fullShippedQty
        );
        expect.fail('Should have thrown');
      } catch (e: unknown) {
        expect((e as { code?: string }).code).toBe(DomainErrorCodes.THREE_WAY_MATCH_FAILED);
      }
    });

    it('should throw on qty mismatch', () => {
      try {
        InvoicePolicy.validate3WayMatching(
          validInvoice,
          order,
          partialShippedQty
        );
        expect.fail('Should have thrown');
      } catch (e: unknown) {
        expect((e as { code?: string }).code).toBe(DomainErrorCodes.THREE_WAY_MATCH_FAILED);
      }
    });
  });
});
