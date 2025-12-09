import { prisma, type Product } from '@sync-erp/database';
import { Decimal } from '@prisma/client/runtime/library';

interface CreateProductInput {
  sku: string;
  name: string;
  price: number;
}

interface UpdateProductInput {
  name?: string;
  price?: number;
}

export class ProductService {
  /**
   * Create a new product
   */
  async create(companyId: string, data: CreateProductInput): Promise<Product> {
    return prisma.product.create({
      data: {
        companyId,
        sku: data.sku,
        name: data.name,
        price: new Decimal(data.price),
        averageCost: new Decimal(0),
        stockQty: 0,
      },
    });
  }

  /**
   * Get product by ID
   */
  async getById(id: string, companyId: string): Promise<Product | null> {
    return prisma.product.findFirst({
      where: { id, companyId },
    });
  }

  /**
   * Get product by SKU
   */
  async getBySku(sku: string, companyId: string): Promise<Product | null> {
    return prisma.product.findFirst({
      where: { sku, companyId },
    });
  }

  /**
   * List all products for a company
   */
  async list(companyId: string): Promise<Product[]> {
    return prisma.product.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Update product
   */
  async update(id: string, companyId: string, data: UpdateProductInput): Promise<Product> {
    const existing = await this.getById(id, companyId);
    if (!existing) {
      throw new Error('Product not found');
    }

    return prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        price: data.price ? new Decimal(data.price) : undefined,
      },
    });
  }

  /**
   * Delete product
   */
  async delete(id: string, companyId: string): Promise<void> {
    const existing = await this.getById(id, companyId);
    if (!existing) {
      throw new Error('Product not found');
    }

    await prisma.product.delete({
      where: { id },
    });
  }

  /**
   * Update stock quantity (called by InventoryService)
   */
  async updateStock(id: string, quantityChange: number): Promise<Product> {
    return prisma.product.update({
      where: { id },
      data: {
        stockQty: {
          increment: quantityChange,
        },
      },
    });
  }

  /**
   * Update average cost (AVCO) after goods receipt
   * Formula: New AVCO = (Old Stock * Old Cost + New Qty * New Cost) / (Old Stock + New Qty)
   */
  async updateAverageCost(
    id: string,
    newQuantity: number,
    newCostPerUnit: number
  ): Promise<Product> {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new Error('Product not found');
    }

    const oldStock = product.stockQty;
    const oldCost = Number(product.averageCost);
    const totalOldValue = oldStock * oldCost;
    const totalNewValue = newQuantity * newCostPerUnit;
    const newTotalStock = oldStock + newQuantity;

    // Calculate new average cost
    const newAvgCost =
      newTotalStock > 0 ? (totalOldValue + totalNewValue) / newTotalStock : newCostPerUnit;

    return prisma.product.update({
      where: { id },
      data: {
        averageCost: new Decimal(newAvgCost),
        stockQty: {
          increment: newQuantity,
        },
      },
    });
  }

  /**
   * Check if stock is sufficient for an order
   */
  async checkStock(id: string, requiredQty: number): Promise<boolean> {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return false;
    }
    return product.stockQty >= requiredQty;
  }
}
