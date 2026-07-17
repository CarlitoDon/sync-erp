import { describe, expect, it } from 'vitest';
import { OrderStatus } from '@sync-erp/database';
import { PurchaseOrderPolicy } from '../../src/modules/procurement/purchase-order.policy';

describe('purchase order policy', () => {
  describe('validateUpdate', () => {
    it('allows notes metadata updates after a purchase order is completed', () => {
      expect(() =>
        PurchaseOrderPolicy.validateUpdate(
          OrderStatus.COMPLETED,
          { notes: 'Supplier reference: 28686' },
          'PO-1'
        )
      ).not.toThrow();
    });

    it('still blocks financial updates after a purchase order is completed', () => {
      expect(() =>
        PurchaseOrderPolicy.validateUpdate(
          OrderStatus.COMPLETED,
          { totalAmount: 500860 },
          'PO-1'
        )
      ).toThrow('Order is not in the correct state');
    });
  });
});
