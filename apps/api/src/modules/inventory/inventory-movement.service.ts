/**
 * Inventory Movement Service
 *
 * Handles stock adjustments and inventory movement tracking.
 * Extracted from inventory.service.ts for better maintainability.
 */

import {
  prisma,
  InventoryMovement,
  MovementType,
  BusinessShape,
  Prisma,
} from '@sync-erp/database';
import { InventoryRepository } from './inventory.repository';
import { ProductService } from '../product/product.service';
import { JournalService } from '../accounting/services/journal.service';
import { InventoryPolicy } from './inventory.policy';
import {
  StockAdjustmentInput,
  DomainError,
  DomainErrorCodes,
} from '@sync-erp/shared';

export class InventoryMovementService {
  constructor(
    private readonly repository: InventoryRepository = new InventoryRepository(),
    private readonly productService: ProductService = new ProductService(),
    private readonly journalService: JournalService = new JournalService()
  ) {}

  async getMovements(
    companyId: string,
    productId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<InventoryMovement[]> {
    return this.repository.findMovements(companyId, productId, tx);
  }

  async getStockLevels(
    companyId: string,
    tx?: Prisma.TransactionClient
  ) {
    return this.productService.list(companyId, tx);
  }

  async adjustStock(
    companyId: string,
    data: StockAdjustmentInput,
    shape?: BusinessShape,
    configs?: { key: string; value: Prisma.JsonValue }[],
    tx?: Prisma.TransactionClient
  ): Promise<InventoryMovement> {
    if (shape) InventoryPolicy.ensureCanAdjustStock(shape);
    if (configs) InventoryPolicy.ensureInventoryEnabled(configs);

    const isLoss = data.quantity < 0;
    const absQty = Math.abs(data.quantity);

    const product = await this.productService.getById(
      data.productId,
      companyId,
      tx
    );
    if (!product)
      throw new DomainError(
        'Product not found',
        404,
        DomainErrorCodes.PRODUCT_NOT_FOUND
      );

    if (isLoss && product.stockQty < absQty) {
      throw new DomainError(
        `Insufficient stock. Current: ${product.stockQty}, Check: ${absQty}`,
        422,
        DomainErrorCodes.INSUFFICIENT_STOCK
      );
    }

    const db = tx || prisma;
    const movement = await this.repository.createMovement(
      {
        companyId,
        productId: data.productId,
        type: data.quantity > 0 ? MovementType.IN : MovementType.OUT,
        quantity: absQty,
        reference: data.reference || 'Manual adjustment',
      },
      db
    );

    let journalAmount = 0;
    if (!isLoss) {
      await this.productService.updateAverageCost(
        data.productId,
        data.quantity,
        data.costPerUnit,
        tx
      );
      journalAmount = absQty * data.costPerUnit;
    } else {
      await this.productService.updateStock(
        data.productId,
        data.quantity,
        tx
      );
      journalAmount = absQty * Number(product.averageCost);
    }

    if (journalAmount > 0) {
      await this.journalService.postAdjustment(
        companyId,
        data.reference || `Adjustment ${movement.id}`,
        journalAmount,
        isLoss,
        tx
      );
    }

    return movement;
  }
}
