import { describe, it, expect } from 'vitest';
import { prisma } from './setup';

describe('Inventory Invariants', () => {
  it('should never have negative stock quantity', async () => {
    const invalidProducts = await prisma.product.findMany({
      where: {
        stockQty: {
          lt: 0,
        },
      },
      select: {
        id: true,
        sku: true,
        stockQty: true,
      },
    });

    if (invalidProducts.length > 0) {
      console.error(
        'Found products with negative stock:',
        invalidProducts
      );
    }

    expect(invalidProducts).toHaveLength(0);
  });

  it('should never have negative average cost', async () => {
    const invalidProducts = await prisma.product.findMany({
      where: {
        averageCost: {
          lt: 0,
        },
      },
      select: {
        id: true,
        sku: true,
        averageCost: true,
      },
    });

    if (invalidProducts.length > 0) {
      console.error(
        'Found products with negative cost:',
        invalidProducts
      );
    }

    expect(invalidProducts).toHaveLength(0);
  });
});
