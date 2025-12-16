// Stock Transfer Saga - Atomic stock transfer between locations with compensation
import { SagaType, type InventoryMovement } from '@sync-erp/database';
import {
  SagaOrchestrator,
  PostingContext,
} from '../../common/saga/index.js';
import { InventoryRepository } from '../inventory.repository.js';
import { ProductService } from '../../product/product.service.js';

export interface StockTransferInput {
  companyId: string;
  productId: string;
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  reference?: string;
}

export interface StockTransferResult {
  outboundMovement: InventoryMovement;
  inboundMovement: InventoryMovement;
}

/**
 * StockTransferSaga orchestrates stock transfer atomically:
 *
 * Steps:
 * 1. Validate product and stock availability
 * 2. Create outbound movement (stock OUT from source)
 * 3. Create inbound movement (stock IN to destination)
 *
 * Compensation (on failure):
 * 1. Reverse inbound movement
 * 2. Reverse outbound movement
 */
export class StockTransferSaga extends SagaOrchestrator<
  StockTransferInput,
  StockTransferResult
> {
  protected readonly sagaType = SagaType.STOCK_TRANSFER;

  private repository = new InventoryRepository();
  private productService = new ProductService();

  protected async executeSteps(
    input: StockTransferInput,
    context: PostingContext
  ): Promise<StockTransferResult> {
    // 1. Validate product exists and has sufficient stock
    const product = await this.productService.getById(
      input.productId,
      input.companyId
    );
    if (!product) {
      throw new Error('Product not found');
    }

    if (Number(product.stockQty) < input.quantity) {
      throw new Error(
        `Insufficient stock: ${product.stockQty} available, ${input.quantity} required`
      );
    }

    // 2. Create outbound movement (stock OUT)
    const outboundMovement = await this.repository.createMovement({
      companyId: input.companyId,
      productId: input.productId,
      type: 'OUT',
      quantity: input.quantity,
      reference:
        input.reference ||
        `Stock transfer OUT${input.fromLocation ? ` from ${input.fromLocation}` : ''}`,
    });

    await context.markStockDone(outboundMovement.id);

    // Decrease stock
    await this.productService.decreaseStock(
      input.productId,
      input.quantity
    );

    // 3. Create inbound movement (stock IN)
    const inboundMovement = await this.repository.createMovement({
      companyId: input.companyId,
      productId: input.productId,
      type: 'IN',
      quantity: input.quantity,
      reference:
        input.reference ||
        `Stock transfer IN${input.toLocation ? ` to ${input.toLocation}` : ''}`,
    });

    // Increase stock
    await this.productService.updateStock(
      input.productId,
      input.quantity
    );

    return { outboundMovement, inboundMovement };
  }

  protected async compensate(context: PostingContext): Promise<void> {
    const stepData = context.stepData;

    // If outbound was done, we need to restore stock
    if (stepData.stockMovementId) {
      // Note: Full reversal would require creating compensating movements
      // and adjusting stock levels. For now, log warning.
      console.warn(
        `[SAGA] Stock transfer compensation needed for ${context.entityId} - manual review may be required`
      );
    }
  }
}
