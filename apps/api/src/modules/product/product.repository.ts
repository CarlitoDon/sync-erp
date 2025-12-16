import { prisma, type Product, Prisma } from '@sync-erp/database';

export class ProductRepository {
  async create(
    data: Prisma.ProductCreateManyInput
  ): Promise<Product> {
    return prisma.product.create({ data });
  }

  async findById(
    id: string,
    companyId?: string
  ): Promise<Product | null> {
    const where: Prisma.ProductWhereInput = { id };
    if (companyId) {
      where.companyId = companyId;
    }
    return prisma.product.findFirst({ where });
  }

  async findBySku(
    sku: string,
    companyId: string
  ): Promise<Product | null> {
    return prisma.product.findFirst({
      where: { sku, companyId },
    });
  }

  async findAll(companyId: string): Promise<Product[]> {
    return prisma.product.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
  }

  async update(
    id: string,
    data: Prisma.ProductUpdateInput
  ): Promise<Product> {
    return prisma.product.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<Product> {
    return prisma.product.delete({
      where: { id },
    });
  }

  // Specialized atomic update
  async incrementStock(
    id: string,
    quantity: number
  ): Promise<Product> {
    return prisma.product.update({
      where: { id },
      data: {
        stockQty: { increment: quantity },
      },
    });
  }

  async decreaseStockWithGuard(
    id: string,
    quantity: number
  ): Promise<Product> {
    return prisma.product.update({
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
