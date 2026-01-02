import { describe, it, expect } from 'vitest';
import { BillPolicy } from '@modules/accounting/policies/bill.policy';
import { InvoiceStatus, OrderStatus } from '@sync-erp/database';
import { DomainErrorCodes } from '@sync-erp/shared';
import { Decimal } from 'decimal.js';

describe('BillPolicy', () => {
  describe('validateCreate', () => {
    it('should pass with valid business date', () => {
      expect(() =>
        BillPolicy.validateCreate({ businessDate: new Date() })
      ).not.toThrow();
    });

    it('should pass without business date', () => {
      expect(() => BillPolicy.validateCreate({})).not.toThrow();
    });
  });

  describe('validateUpdate', () => {
    const draftBill = {
      id: 'bill-1',
      status: InvoiceStatus.DRAFT,
      orderId: null,
      amount: new Decimal(100000),
    } as any;

    const poLinkedBill = {
      ...draftBill,
      orderId: 'po-1',
    };

    const postedBill = {
      ...draftBill,
      status: InvoiceStatus.POSTED,
    };

    it('should pass for DRAFT bill with no PO link', () => {
      expect(() =>
        BillPolicy.validateUpdate(draftBill, { memo: 'Updated' })
      ).not.toThrow();
    });

    it('should throw if bill is not DRAFT', () => {
      expect(() =>
        BillPolicy.validateUpdate(postedBill, { memo: 'Updated' })
      ).toThrow();
    });

    it('should allow same amount for PO-linked bill', () => {
      expect(() =>
        BillPolicy.validateUpdate(poLinkedBill, { amount: 100000 })
      ).not.toThrow();
    });

    it('should throw if changing amount on PO-linked bill', () => {
      expect(() =>
        BillPolicy.validateUpdate(poLinkedBill, { amount: 150000 })
      ).toThrow();
    });
  });

  describe('validatePost', () => {
    it('should pass for DRAFT status', () => {
      expect(() =>
        BillPolicy.validatePost(InvoiceStatus.DRAFT)
      ).not.toThrow();
    });

    it('should throw for POSTED status', () => {
      expect(() =>
        BillPolicy.validatePost(InvoiceStatus.POSTED)
      ).toThrow();
    });

    it('should throw for PAID status', () => {
      expect(() =>
        BillPolicy.validatePost(InvoiceStatus.PAID)
      ).toThrow();
    });
  });

  describe('ensureOrderReadyForBill', () => {
    it('should pass for CONFIRMED order', () => {
      expect(() =>
        BillPolicy.ensureOrderReadyForBill({
          status: OrderStatus.CONFIRMED,
        })
      ).not.toThrow();
    });

    it('should pass for RECEIVED order', () => {
      expect(() =>
        BillPolicy.ensureOrderReadyForBill({
          status: OrderStatus.RECEIVED,
        })
      ).not.toThrow();
    });

    it('should pass for PARTIALLY_RECEIVED order', () => {
      expect(() =>
        BillPolicy.ensureOrderReadyForBill({
          status: OrderStatus.PARTIALLY_RECEIVED,
        })
      ).not.toThrow();
    });

    it('should pass for COMPLETED order', () => {
      expect(() =>
        BillPolicy.ensureOrderReadyForBill({
          status: OrderStatus.COMPLETED,
        })
      ).not.toThrow();
    });

    it('should throw for DRAFT order', () => {
      expect(() =>
        BillPolicy.ensureOrderReadyForBill({
          status: OrderStatus.DRAFT,
        })
      ).toThrow();
    });

    it('should throw for CANCELLED order', () => {
      expect(() =>
        BillPolicy.ensureOrderReadyForBill({
          status: OrderStatus.CANCELLED,
        })
      ).toThrow();
    });
  });

  describe('ensureGoodsReceived', () => {
    it('should pass when GRN count > 0', () => {
      expect(() => BillPolicy.ensureGoodsReceived(1)).not.toThrow();
    });

    it('should throw when GRN count is 0', () => {
      expect(() => BillPolicy.ensureGoodsReceived(0)).toThrow();
    });
  });

  describe('validate3WayMatching', () => {
    const validBill = {
      amount: new Decimal(1100000),
      subtotal: new Decimal(1000000),
      notes: null,
    };

    const dpBill = {
      ...validBill,
      notes: 'Down Payment Bill (30%)',
    };

    const order = {
      items: [
        { productId: 'p1', quantity: 10, price: new Decimal(100000) },
      ],
      totalAmount: new Decimal(1100000),
      dpAmount: null,
      paymentTerms: 'NET30',
    };

    const fullReceivedQty = new Map([['p1', 10]]);
    const partialReceivedQty = new Map([['p1', 5]]);
    const noReceivedQty = new Map<string, number>();

    it('should pass when subtotal and qty match', () => {
      expect(() =>
        BillPolicy.validate3WayMatching(
          validBill,
          order,
          fullReceivedQty
        )
      ).not.toThrow();
    });

    it('should skip validation for DP Bills', () => {
      expect(() =>
        BillPolicy.validate3WayMatching(dpBill, order, noReceivedQty)
      ).not.toThrow();
    });

    it('should skip validation for isDpBill=true', () => {
      expect(() =>
        BillPolicy.validate3WayMatching(
          validBill,
          order,
          noReceivedQty,
          true
        )
      ).not.toThrow();
    });

    it('should skip for UPFRONT with no GRN', () => {
      const upfrontOrder = {
        ...order,
        paymentTerms: 'UPFRONT',
      };
      expect(() =>
        BillPolicy.validate3WayMatching(
          validBill,
          upfrontOrder,
          noReceivedQty
        )
      ).not.toThrow();
    });

    it('should allow partial billing when subtotal is less than order', () => {
      // Feature 041: Partial billing is allowed (e.g., billing per GRN)
      const partialBill = {
        ...validBill,
        subtotal: new Decimal(500000), // Half of order subtotal
      };
      expect(() =>
        BillPolicy.validate3WayMatching(
          partialBill,
          order,
          fullReceivedQty
        )
      ).not.toThrow();
    });

    it('should throw on subtotal mismatch when subtotal exceeds order', () => {
      // Only throws when bill subtotal is >= order subtotal but mismatched
      const overBill = {
        ...validBill,
        subtotal: new Decimal(1100000), // Exceeds order subtotal (1M)
      };
      try {
        BillPolicy.validate3WayMatching(
          overBill,
          order,
          fullReceivedQty
        );
        expect.fail('Should have thrown');
      } catch (e: any) {
        expect(e.code).toBe(DomainErrorCodes.THREE_WAY_MATCH_FAILED);
      }
    });

    it('should throw on qty mismatch', () => {
      try {
        BillPolicy.validate3WayMatching(
          validBill,
          order,
          partialReceivedQty
        );
        expect.fail('Should have thrown');
      } catch (e: any) {
        expect(e.code).toBe(DomainErrorCodes.THREE_WAY_MATCH_FAILED);
      }
    });
  });
});
