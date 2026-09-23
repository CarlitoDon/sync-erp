import { describe, expect, it } from 'vitest';
import {
  isMattress,
  calculateTotalMattressesInOrder,
  calculateCrossInventoryDemand,
  calculateRemainingForLine,
  type PoolRentalItem,
  type PoolRentalBundle,
} from '../../src/utils/rental-inventory-pool';

describe('rental-inventory-pool', () => {
  const rentalItems: PoolRentalItem[] = [
    {
      id: 'item-kasur-90',
      product: { name: 'Kasur Busa 90x200' },
      category: { name: 'Kasur' },
    },
    {
      id: 'item-sprei-90',
      product: { name: 'Sprei 90x200' },
      category: { name: 'Perlengkapan Tidur' },
    },
    {
      id: 'item-bantal',
      product: { name: 'Bantal Standar' },
      category: { name: 'Perlengkapan Tidur' },
    },
    {
      id: 'item-kasur-120',
      product: { name: 'Kasur Busa 120x200' },
      category: { name: 'Kasur' },
    },
    {
      id: 'item-kasur-160',
      product: { name: 'Kasur Busa 160x200' },
      category: { name: 'Kasur' },
    },
  ];

  const rentalBundles: PoolRentalBundle[] = [
    {
      id: 'bundle-paket-90',
      name: 'Single Standard (Paket 90)',
      components: [
        {
          rentalItemId: 'item-kasur-90',
          quantity: 1,
          componentLabel: 'Kasur busa 90x200',
        },
        {
          rentalItemId: 'item-sprei-90',
          quantity: 1,
          componentLabel: 'Sprei bersih 90x200',
        },
        {
          rentalItemId: 'item-bantal',
          quantity: 1,
          componentLabel: 'Bantal standar',
        },
      ],
    },
    {
      id: 'bundle-paket-120',
      name: 'Double (Paket 120)',
      components: [
        {
          rentalItemId: 'item-kasur-120',
          quantity: 1,
          componentLabel: 'Kasur busa 120x200',
        },
        {
          rentalItemId: 'item-bantal',
          quantity: 2,
          componentLabel: 'Bantal standar',
        },
      ],
    },
  ];

  describe('isMattress', () => {
    it('detects mattress from categoryName, productName, or label', () => {
      expect(isMattress({ categoryName: 'Kasur' })).toBe(true);
      expect(isMattress({ productName: 'Kasur Busa 90' })).toBe(true);
      expect(isMattress({ label: 'Kasur busa' })).toBe(true);
      expect(isMattress({ productName: 'Matras single' })).toBe(true);
      expect(isMattress({ productName: 'Springbed 160x200' })).toBe(true);
      expect(isMattress({ productName: 'Spring Bed 120' })).toBe(true);
      expect(isMattress({ categoryName: 'Bantal', productName: 'Bantal Standar' })).toBe(false);
      expect(isMattress({ productName: 'Sprei Kasur 90' })).toBe(false);
      expect(isMattress({ productName: 'Sarung Kasur 160' })).toBe(false);
      expect(isMattress({ categoryName: 'Sprei', productName: 'Kasur' })).toBe(false);
      expect(isMattress({})).toBe(false);
    });
  });

  describe('calculateTotalMattressesInOrder', () => {
    it('returns 0 for empty or non-mattress orders', () => {
      expect(calculateTotalMattressesInOrder([], rentalItems, rentalBundles)).toBe(0);
      expect(
        calculateTotalMattressesInOrder(
          [{ type: 'item', rentalItemId: 'item-bantal', quantity: 5 }],
          rentalItems,
          rentalBundles
        )
      ).toBe(0);
    });

    it('calculates mattresses for standalone items', () => {
      const items = [
        { type: 'item' as const, rentalItemId: 'item-kasur-90', quantity: 2 },
        { type: 'item' as const, rentalItemId: 'item-kasur-160', quantity: 1 },
        { type: 'item' as const, rentalItemId: 'item-bantal', quantity: 10 },
      ];
      expect(calculateTotalMattressesInOrder(items, rentalItems, rentalBundles)).toBe(3);
    });

    it('calculates mattresses for bundles and combinations (2 Paket 120 + 1 Kasur 160 = 3)', () => {
      const items = [
        { type: 'bundle' as const, rentalBundleId: 'bundle-paket-120', quantity: 2 },
        { type: 'item' as const, rentalItemId: 'item-kasur-160', quantity: 1 },
      ];
      expect(calculateTotalMattressesInOrder(items, rentalItems, rentalBundles)).toBe(3);
    });

    it('handles fallback when bundle components are unpopulated but bundle name has paket', () => {
      const bareBundle: PoolRentalBundle = {
        id: 'bundle-bare',
        name: 'Paket Kasur Lengkap',
        components: [],
      };
      const items = [
        { type: 'bundle' as const, rentalBundleId: 'bundle-bare', quantity: 4 },
      ];
      expect(calculateTotalMattressesInOrder(items, rentalItems, [bareBundle])).toBe(4);
    });
  });

  describe('calculateCrossInventoryDemand', () => {
    const availabilityMap: Record<string, number> = {
      'item-kasur-90': 13,
      'item-sprei-90': 13,
      'item-bantal': 60,
      'item-kasur-120': 5,
      'item-kasur-160': 6,
    };

    it('returns no conflict when combination is within warehouse limits (13 Paket 90 + 5 Bantal = 18 Bantal <= 60)', () => {
      const items = [
        { type: 'bundle' as const, rentalBundleId: 'bundle-paket-90', quantity: 13 },
        { type: 'item' as const, rentalItemId: 'item-bantal', quantity: 5 },
      ];

      const result = calculateCrossInventoryDemand({
        items,
        rentalItems,
        rentalBundles,
        availabilityMap,
      });

      expect(result.hasConflict).toBe(false);
      expect(result.conflicts).toHaveLength(0);
      expect(result.demandMap['item-kasur-90']).toBe(13);
      expect(result.demandMap['item-sprei-90']).toBe(13);
      expect(result.demandMap['item-bantal']).toBe(18);
    });

    it('flags conflict when bantal is overbooked (13 Paket 90 + 50 Bantal = 63 Bantal > 60)', () => {
      const items = [
        { type: 'bundle' as const, rentalBundleId: 'bundle-paket-90', quantity: 13 },
        { type: 'item' as const, rentalItemId: 'item-bantal', quantity: 50 },
      ];

      const result = calculateCrossInventoryDemand({
        items,
        rentalItems,
        rentalBundles,
        availabilityMap,
      });

      expect(result.hasConflict).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      const conflict = result.conflicts[0];
      expect(conflict.rentalItemId).toBe('item-bantal');
      expect(conflict.itemName).toBe('Bantal Standar');
      expect(conflict.totalRequired).toBe(63);
      expect(conflict.totalAvailable).toBe(60);
      expect(conflict.shortage).toBe(3);
      expect(conflict.message).toContain('Total kebutuhan: 63');
      expect(conflict.message).toContain('tersedia hanya 60 unit');
    });

    it('flags conflict when standalone kasur is ordered together with all bundle packages (13 Paket 90 + 1 Kasur 90 > 13)', () => {
      const items = [
        { type: 'bundle' as const, rentalBundleId: 'bundle-paket-90', quantity: 13 },
        { type: 'item' as const, rentalItemId: 'item-kasur-90', quantity: 1 },
      ];

      const result = calculateCrossInventoryDemand({
        items,
        rentalItems,
        rentalBundles,
        availabilityMap,
      });

      expect(result.hasConflict).toBe(true);
      const conflict = result.conflicts.find((c) => c.rentalItemId === 'item-kasur-90');
      expect(conflict).toBeDefined();
      expect(conflict?.totalRequired).toBe(14);
      expect(conflict?.totalAvailable).toBe(13);
      expect(conflict?.shortage).toBe(1);
    });
  });

  describe('calculateRemainingForLine', () => {
    const availabilityMap: Record<string, number> = {
      'item-kasur-90': 13,
      'item-sprei-90': 13,
      'item-bantal': 60,
      'item-kasur-120': 5,
    };

    it('calculates remaining for line 1 when line 0 ordered 13 Paket 90', () => {
      const items = [
        { type: 'bundle' as const, rentalBundleId: 'bundle-paket-90', quantity: 13 },
        { type: 'item' as const, rentalItemId: '', quantity: 1 },
      ];

      // Line 1 tries to pick Kasur 90 -> 0 remaining (13 - 13 = 0)
      const remainingKasur = calculateRemainingForLine({
        lineIdx: 1,
        targetType: 'item',
        targetId: 'item-kasur-90',
        items,
        rentalItems,
        rentalBundles,
        availabilityMap,
      });
      expect(remainingKasur).toBe(0);

      // Line 1 tries to pick Paket 90 -> 0 remaining
      const remainingPaket = calculateRemainingForLine({
        lineIdx: 1,
        targetType: 'bundle',
        targetId: 'bundle-paket-90',
        items,
        rentalItems,
        rentalBundles,
        availabilityMap,
      });
      expect(remainingPaket).toBe(0);

      // Line 1 tries to pick Bantal Standar -> 47 remaining (60 - 13 = 47)
      const remainingBantal = calculateRemainingForLine({
        lineIdx: 1,
        targetType: 'item',
        targetId: 'item-bantal',
        items,
        rentalItems,
        rentalBundles,
        availabilityMap,
      });
      expect(remainingBantal).toBe(47);

      // Line 0 itself is evaluated -> sees its own max capacity is 13
      const line0Remaining = calculateRemainingForLine({
        lineIdx: 0,
        targetType: 'bundle',
        targetId: 'bundle-paket-90',
        items,
        rentalItems,
        rentalBundles,
        availabilityMap,
      });
      expect(line0Remaining).toBe(13);
    });
  });
});
