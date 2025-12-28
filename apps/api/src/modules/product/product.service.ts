import { Product, Prisma } from '@sync-erp/database';
import { ProductRepository } from './product.repository';
import {
  CreateProductInput,
  UpdateProductInput,
  DomainError,
  DomainErrorCodes,
} from '@sync-erp/shared';
import { calculateNewAvgCost } from '../inventory/rules/stockRule';

export class ProductService {
  private repository = new ProductRepository();

  async create(
    companyId: string,
    data: CreateProductInput,
    tx?: Prisma.TransactionClient
  ): Promise<Product> {
    return this.repository.create(
      {
        companyId,
        sku: data.sku,
        name: data.name,
        price: data.price,
        averageCost: 0,
        stockQty: 0,
      },
      tx
    );
  }

  async getById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient
  ): Promise<Product | null> {
    return this.repository.findById(id, companyId, tx);
  }

  async getBySku(
    sku: string,
    companyId: string,
    tx?: Prisma.TransactionClient
  ): Promise<Product | null> {
    return this.repository.findBySku(sku, companyId, tx);
  }

  async list(
    companyId: string,
    tx?: Prisma.TransactionClient
  ): Promise<Product[]> {
    return this.repository.findAll(companyId, tx);
  }

  async update(
    id: string,
    companyId: string,
    data: UpdateProductInput,
    tx?: Prisma.TransactionClient
  ): Promise<Product> {
    const existing = await this.getById(id, companyId, tx);
    if (!existing) {
      throw new DomainError(
        'Product not found',
        404,
        DomainErrorCodes.PRODUCT_NOT_FOUND
      );
    }
    return this.repository.update(id, data, tx);
  }

  async delete(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const existing = await this.getById(id, companyId, tx);
    if (!existing) {
      throw new DomainError(
        'Product not found',
        404,
        DomainErrorCodes.PRODUCT_NOT_FOUND
      );
    }
    await this.repository.delete(id, tx);
  }

  async updateStock(
    id: string,
    quantityChange: number,
    tx?: Prisma.TransactionClient
  ): Promise<Product> {
    return this.repository.incrementStock(id, quantityChange, tx);
  }

  async decreaseStock(
    id: string,
    quantity: number,
    tx?: Prisma.TransactionClient
  ): Promise<Product> {
    try {
      return await this.repository.decreaseStockWithGuard(
        id,
        quantity,
        tx
      );
    } catch (error) {
      if (
        (error as Prisma.PrismaClientKnownRequestError).code ===
        // eslint-disable-next-line @sync-erp/no-hardcoded-enum -- P2025 is Prisma's "Record not found" error code
        'P2025'
      ) {
        throw new DomainError(
          'Insufficient stock or product not found',
          422,
          DomainErrorCodes.INSUFFICIENT_STOCK
        );
      }
      throw error;
    }
  }

  /**
   * Update product stock and recalculate weighted average cost.
   * Uses stockRule.calculateNewAvgCost for DRY compliance.
   */
  async updateAverageCost(
    id: string,
    newQuantity: number,
    newCostPerUnit: number,
    tx?: Prisma.TransactionClient
  ): Promise<Product> {
    const product = await this.repository.findById(id, undefined, tx);
    if (!product) {
      throw new DomainError(
        'Product not found',
        404,
        DomainErrorCodes.PRODUCT_NOT_FOUND
      );
    }

    // Use stockRule for AVG calculation (Constitution compliance)
    const newAvgCost = calculateNewAvgCost(
      product.stockQty,
      Number(product.averageCost),
      newQuantity,
      newCostPerUnit
    );

    return this.repository.update(
      id,
      {
        averageCost: newAvgCost,
        stockQty: { increment: newQuantity },
      },
      tx
    );
  }

  async checkStock(
    id: string,
    requiredQty: number,
    tx?: Prisma.TransactionClient
  ): Promise<boolean> {
    const product = await this.repository.findById(id, undefined, tx);
    if (!product) {
      return false;
    }
    return product.stockQty >= requiredQty;
  }
}
