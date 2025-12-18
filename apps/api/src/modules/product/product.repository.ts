import { prisma, type Product, Prisma } from '@sync-erp/database';

export class ProductRepository {
  async create(
    data: Prisma.ProductCreateManyInput,
    tx?: Prisma.TransactionClient
  ): Promise<Product> {
    const db = tx || prisma;
    return db.product.create({ data });
  }

  async findById(
    id: string,
    companyId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<Product | null> {
    const db = tx || prisma;
    const where: Prisma.ProductWhereInput = { id };
    if (companyId) {
      where.companyId = companyId;
    }
    return db.product.findFirst({ where });
  }

  async findBySku(
    sku: string,
    companyId: string,
    tx?: Prisma.TransactionClient
  ): Promise<Product | null> {
    const db = tx || prisma;
    return db.product.findFirst({
      where: { sku, companyId },
    });
  }

  async findAll(
    companyId: string,
    tx?: Prisma.TransactionClient
  ): Promise<Product[]> {
    const db = tx || prisma;
    return db.product.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
  }

  async update(
    id: string,
    data: Prisma.ProductUpdateInput,
    tx?: Prisma.TransactionClient
  ): Promise<Product> {
    const db = tx || prisma;
    return db.product.update({
      where: { id },
      data,
    });
  }

  async delete(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<Product> {
    const db = tx || prisma;
    return db.product.delete({
      where: { id },
    });
  }

  // Specialized atomic update
  async incrementStock(
    id: string,
    quantity: number,
    tx?: Prisma.TransactionClient
  ): Promise<Product> {
    const db = tx || prisma;
    return db.product.update({
      where: { id },
      data: {
        stockQty: { increment: quantity },
      },
    });
  }

  /**
   * Decrease stock with concurrency guard.
   * NOTE: Caller (Service) must validate stock sufficiency via Policy BEFORE calling this.
   * This is a low-level atomic operation.
   */
  async decreaseStockWithGuard(
    id: string,
    quantity: number,
    tx?: Prisma.TransactionClient
  ): Promise<Product> {
    const db = tx || prisma;

    // Atomic decrement with concurrency guard
    // Guard ensures no race condition even if multiple requests hit simultaneously
    return db.product.update({
      where: {
        id,
        stockQty: { gte: quantity }, // Concurrency Guard
      },
      data: {
        stockQty: { decrement: quantity },
      },
    });
  }
}
