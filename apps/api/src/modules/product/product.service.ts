import { Product } from '@sync-erp/database';
import { ProductRepository } from './product.repository';
import {
  CreateProductInput,
  UpdateProductInput,
} from '@sync-erp/shared';

export class ProductService {
  private repository = new ProductRepository();

  async create(
    companyId: string,
    data: CreateProductInput
  ): Promise<Product> {
    return this.repository.create({
      companyId,
      sku: data.sku,
      name: data.name,
      price: data.price,
      averageCost: 0,
      stockQty: 0,
    });
  }

  async getById(
    id: string,
    companyId: string
  ): Promise<Product | null> {
    return this.repository.findById(id, companyId);
  }

  async getBySku(
    sku: string,
    companyId: string
  ): Promise<Product | null> {
    return this.repository.findBySku(sku, companyId);
  }

  async list(companyId: string): Promise<Product[]> {
    return this.repository.findAll(companyId);
  }

  async update(
    id: string,
    companyId: string,
    data: UpdateProductInput
  ): Promise<Product> {
    const existing = await this.getById(id, companyId);
    if (!existing) {
      throw new Error('Product not found');
    }
    return this.repository.update(id, data);
  }

  async delete(id: string, companyId: string): Promise<void> {
    const existing = await this.getById(id, companyId);
    if (!existing) {
      throw new Error('Product not found');
    }
    await this.repository.delete(id);
  }

  async updateStock(
    id: string,
    quantityChange: number
  ): Promise<Product> {
    return this.repository.incrementStock(id, quantityChange);
  }

  async updateAverageCost(
    id: string,
    newQuantity: number,
    newCostPerUnit: number
  ): Promise<Product> {
    const product = await this.repository.findById(id);
    if (!product) {
      throw new Error('Product not found');
    }

    const oldStock = product.stockQty;
    const oldCost = Number(product.averageCost);
    const totalOldValue = oldStock * oldCost;
    const totalNewValue = newQuantity * newCostPerUnit;
    const newTotalStock = oldStock + newQuantity;

    const newAvgCost =
      newTotalStock > 0
        ? (totalOldValue + totalNewValue) / newTotalStock
        : newCostPerUnit;

    return this.repository.update(id, {
      averageCost: newAvgCost,
      stockQty: { increment: newQuantity },
    });
  }

  async checkStock(
    id: string,
    requiredQty: number
  ): Promise<boolean> {
    const product = await this.repository.findById(id);
    if (!product) {
      return false;
    }
    return product.stockQty >= requiredQty;
  }
}
