import { describe, it, expect } from 'vitest';
import {
  calculateRentalOrderBreakdown,
  type RentalOrderLike,
} from '@/features/rental/utils/rentalOrderBreakdown';

describe('calculateRentalOrderBreakdown', () => {
  it('returns zeroes when order is null or undefined', () => {
    const res = calculateRentalOrderBreakdown(null);
    expect(res.subtotal).toBe(0);
    expect(res.totalAmount).toBe(0);
    expect(res.baseDeliveryFee).toBe(0);
    expect(res.upstairsTotalFee).toBe(0);
    expect(res.fittedSheetTotalFee).toBe(0);
    expect(res.discounts).toEqual([]);
    expect(res.remainingBalance).toBe(0);
  });

  it('correctly calculates the prompt example: 70k subtotal, 12k ongkir, 3.5k upstairs, 2k fitted sheet = 87.5k total', () => {
    const order: RentalOrderLike = {
      subtotal: 70000,
      deliveryFee: 17500, // Total delivery fee in DB includes 12k base + 3.5k upstairs + 2k fitted
      totalAmount: 87500,
      notes:
        'Kasur naik lantai atas: 1 unit\nKasur dipasang sprei: 1 unit\nTolong konfirmasi sebelum kirim',
      items: [{ subtotal: 70000 }],
    };

    const breakdown = calculateRentalOrderBreakdown(order, 26250);

    expect(breakdown.subtotal).toBe(70000);
    expect(breakdown.upstairsCount).toBe(1);
    expect(breakdown.upstairsTotalFee).toBe(3500);
    expect(breakdown.fittedSheetCount).toBe(1);
    expect(breakdown.fittedSheetTotalFee).toBe(2000);
    expect(breakdown.baseDeliveryFee).toBe(12000);
    expect(breakdown.totalAmount).toBe(87500);
    expect(breakdown.depositAmount).toBe(26250);
    expect(breakdown.remainingBalance).toBe(61250);
    expect(breakdown.isFullyPaid).toBe(false);
  });

  it('parses base delivery fee explicitly from notes if present', () => {
    const order: RentalOrderLike = {
      subtotal: 100000,
      deliveryFee: 20000,
      totalAmount: 120000,
      notes: 'Ongkos kirim dasar: Rp 20.000\nPengantaran pagi',
    };

    const breakdown = calculateRentalOrderBreakdown(order, 50000);
    expect(breakdown.subtotal).toBe(100000);
    expect(breakdown.baseDeliveryFee).toBe(20000);
    expect(breakdown.upstairsTotalFee).toBe(0);
    expect(breakdown.fittedSheetTotalFee).toBe(0);
    expect(breakdown.remainingBalance).toBe(70000);
  });

  it('handles policySnapshot discounts and custom unit fees', () => {
    const order: RentalOrderLike = {
      subtotal: 200000,
      deliveryFee: 25000,
      totalAmount: 195000,
      notes: 'Kasur naik ke lantai 2: 2\nDipasang sprei: 1',
      policySnapshot: {
        upstairsFeePerUnit: 4000,
        fittedSheetFeePerUnit: 2500,
        discounts: [
          {
            id: 'promo-1',
            label: 'Diskon Akhir Pekan',
            type: 'PERCENTAGE',
            value: 10,
            amount: 20000,
          },
          {
            id: 'promo-2',
            label: 'Voucher Ongkir',
            type: 'FIXED',
            amount: 10000,
          },
        ],
      },
    };

    const breakdown = calculateRentalOrderBreakdown(order, 195000);
    expect(breakdown.upstairsCount).toBe(2);
    expect(breakdown.upstairsTotalFee).toBe(8000);
    expect(breakdown.fittedSheetCount).toBe(1);
    expect(breakdown.fittedSheetTotalFee).toBe(2500);
    expect(breakdown.baseDeliveryFee).toBe(25000 - 8000 - 2500); // 14500
    expect(breakdown.discounts).toHaveLength(2);
    expect(breakdown.totalDiscountAmount).toBe(30000);
    expect(breakdown.depositAmount).toBe(195000);
    expect(breakdown.remainingBalance).toBe(0);
    expect(breakdown.isFullyPaid).toBe(true);
  });

  it('handles fallback single discount from discountAmount and discountLabel', () => {
    const order: RentalOrderLike = {
      subtotal: 50000,
      discountAmount: 5000,
      discountLabel: 'Potongan Khusus',
      deliveryFee: 10000,
      totalAmount: 55000,
    };

    const breakdown = calculateRentalOrderBreakdown(order, 20000);
    expect(breakdown.discounts).toHaveLength(1);
    expect(breakdown.discounts[0].label).toBe('Potongan Khusus');
    expect(breakdown.discounts[0].amount).toBe(5000);
    expect(breakdown.totalDiscountAmount).toBe(5000);
    expect(breakdown.remainingBalance).toBe(35000);
  });

  it('falls back to order.depositAmount when depositInput is not provided', () => {
    const order: RentalOrderLike = {
      subtotal: 100000,
      totalAmount: 100000,
      depositAmount: 30000,
    };
    const breakdown = calculateRentalOrderBreakdown(order);
    expect(breakdown.depositAmount).toBe(30000);
    expect(breakdown.remainingBalance).toBe(70000);
  });

  it('safely caps baseDeliveryFee to 0 when deliveryFee is smaller than special logistics fees', () => {
    const order: RentalOrderLike = {
      subtotal: 50000,
      deliveryFee: 3000,
      notes: 'Kasur naik lantai atas: 1 unit', // upstairs fee = 3500
      totalAmount: 53500,
    };
    const breakdown = calculateRentalOrderBreakdown(order, 10000);
    expect(breakdown.upstairsTotalFee).toBe(3500);
    expect(breakdown.baseDeliveryFee).toBe(0); // 3000 - 3500 < 0 -> clamped to 0
  });

  it('computes totalAmount from subtotal and logistics when order.totalAmount is 0 or omitted', () => {
    const order: RentalOrderLike = {
      subtotal: 70000,
      deliveryFee: 15000,
      totalAmount: 0,
      discountAmount: 5000,
    };
    const breakdown = calculateRentalOrderBreakdown(order, 0);
    expect(breakdown.totalAmount).toBe(80000); // 70000 + 15000 - 5000
  });
});
