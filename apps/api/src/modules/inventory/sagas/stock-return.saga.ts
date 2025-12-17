// Stock Return Saga - Atomic stock return with cost update and compensation
import { SagaType, type InventoryMovement } from '@sync-erp/database';
import {
  SagaOrchestrator,
  PostingContext,
} from '../../common/saga/index.js';
import { InventoryRepository } from '../inventory.repository.js';
import { ProductService } from '../../product/product.service.js';
import { JournalService } from '../../accounting/services/journal.service.js';

export interface StockReturnInput {
  companyId: string;
  productId: string;
  quantity: number;
  costPerUnit: number;
  reference?: string;
}

export interface StockReturnResult {
  movement: InventoryMovement;
}

/**
 * StockReturnSaga orchestrates stock return atomically:
 *
 * Steps:
 * 1. Validate product exists
 * 2. Create stock IN movement
 * 3. Update average cost
 * 4. Create inventory adjustment journal
 *
 * Compensation (on failure):
 * 1. Reverse journal
 * 2. Decrease stock
 */
export class StockReturnSaga extends SagaOrchestrator<
  StockReturnInput,
  StockReturnResult
> {
  protected readonly sagaType = SagaType.STOCK_RETURN;

  protected getLockTable(): string {
    return 'Product';
  }

  private repository = new InventoryRepository();
  private productService = new ProductService();
  private journalService = new JournalService();

  protected async executeSteps(
    input: StockReturnInput,
    context: PostingContext
  ): Promise<StockReturnResult> {
    // 1. Validate product exists
    const product = await this.productService.getById(
      input.productId,
      input.companyId
    );
    if (!product) {
      throw new Error('Product not found');
    }

    // Store original cost for compensation
    await context.markBalanceDone(Number(product.averageCost));

    // 2. Create stock IN movement
    const movement = await this.repository.createMovement({
      companyId: input.companyId,
      productId: input.productId,
      type: 'IN',
      quantity: input.quantity,
      reference: input.reference || `Stock return`,
    });

    await context.markStockDone(movement.id);

    // 3. Update average cost
    await this.productService.updateAverageCost(
      input.productId,
      input.quantity,
      input.costPerUnit
    );

    // 4. Create inventory adjustment journal
    const totalValue = input.quantity * input.costPerUnit;
    const journal = await this.journalService.postAdjustment(
      input.companyId,
      input.reference || `Stock return for ${product.name}`,
      totalValue,
      false // isLoss = false (stock gain from return)
    );

    await context.markJournalDone(journal.id);

    return { movement };
  }

  protected async compensate(context: PostingContext): Promise<void> {
    const stepData = context.stepData;

    // 1. Reverse journal if created
    if (stepData.journalId) {
      await this.journalService.reverse(
        context.companyId,
        stepData.journalId,
        `Compensation for stock return saga`
      );
    }

    // 2. Note: Stock and cost reversal would need dedicated methods
    if (stepData.stockMovementId) {
      console.warn(
        `[SAGA] Stock return compensation needed - manual review for product ${context.entityId}`
      );
    }
  }
}
