import { describe, expect, it } from 'vitest';
import {
  CreateGoodsReceiptSchema,
  CreateShipmentSchema,
} from '../../src/validators/inventory';

const uuid = '11111111-1111-4111-8111-111111111111';

describe('inventory validators', () => {
  it('accepts plain business dates for goods receipts', () => {
    const parsed = CreateGoodsReceiptSchema.parse({
      purchaseOrderId: uuid,
      date: '2026-01-29',
      items: [{ productId: uuid, quantity: 1 }],
    });

    expect(parsed.date).toBe('2026-01-29');
  });

  it('accepts plain business dates for shipments', () => {
    const parsed = CreateShipmentSchema.parse({
      salesOrderId: uuid,
      date: '2026-01-29',
      items: [{ productId: uuid, quantity: 1 }],
    });

    expect(parsed.date).toBe('2026-01-29');
  });
});
