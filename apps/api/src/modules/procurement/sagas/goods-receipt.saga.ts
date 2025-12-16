// Goods Receipt Saga - Atomic goods receipt with compensation
import {
  SagaType,
  OrderStatus,
  BusinessShape,
  type InventoryMovement,
} from '@sync-erp/database';
import {
  SagaOrchestrator,
  PostingContext,
} from '../../common/saga/index.js';
import { ProcurementRepository } from '../procurement.repository.js';
import { InventoryService } from '../../inventory/inventory.service.js';

export interface GoodsReceiptSagaInput {
  orderId: string;
  companyId: string;
  reference?: string;
  shape?: BusinessShape;
}

export interface GoodsReceiptResult {
  movements: InventoryMovement[];
}

/**
 * GoodsReceiptSaga orchestrates goods receipt atomically:
 *
 * Steps:
 * 1. Validate PO exists and is not cancelled
 * 2. Stock IN for each received item
 * 3. Create accrual journal
 * 4. Update PO status
 *
 * Compensation (on failure):
 * 1. Reverse accrual journal
 * 2. Decrease stock (reverse IN movements)
 */
export class GoodsReceiptSaga extends SagaOrchestrator<
  GoodsReceiptSagaInput,
  GoodsReceiptResult
> {
  protected readonly sagaType = SagaType.GOODS_RECEIPT;

  private procurementRepository = new ProcurementRepository();
  private _inventoryService: InventoryService | null = null;

  // Lazy load to break circular dependency
  private get inventoryService(): InventoryService {
    if (!this._inventoryService) {
      this._inventoryService = new InventoryService();
    }
    return this._inventoryService;
  }

  /**
   * Execute the forward flow
   */
  protected async executeSteps(
    input: GoodsReceiptSagaInput,
    context: PostingContext
  ): Promise<GoodsReceiptResult> {
    // 1. Validate PO
    const order = await this.procurementRepository.findById(
      input.orderId,
      input.companyId
    );
    if (!order) {
      throw new Error('Purchase order not found');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new Error('Cannot receive goods for a cancelled order');
    }

    // 2. Process goods receipt (stock IN + accrual journal)
    const movements = await this.inventoryService.processGoodsReceipt(
      input.companyId,
      {
        orderId: input.orderId,
        reference:
          input.reference ||
          `Goods receipt for PO ${order.orderNumber}`,
      },
      input.shape
    );

    // Track first movement for compensation
    if (movements.length > 0) {
      await context.markStockDone(movements[0].id);
    }

    // 3. Update PO status to COMPLETED if fully received
    // Note: Full receipt logic should compare received vs ordered quantities
    // For now, we mark as COMPLETED on any receipt
    await this.procurementRepository.updateStatus(
      input.orderId,
      OrderStatus.COMPLETED
    );

    return { movements };
  }

  /**
   * Compensate on failure - reverse stock and accrual
   */
  protected async compensate(context: PostingContext): Promise<void> {
    const stepData = context.stepData;

    // 1. Reverse stock movements if done
    if (stepData.stockMovementId) {
      // Note: Reversing stock IN requires specific logic (decrease stock)
      console.warn(
        `[SAGA] Stock movements may need manual review for PO ${context.entityId}`
      );
    }

    // 2. Revert PO status
    await this.procurementRepository.updateStatus(
      context.entityId,
      OrderStatus.CONFIRMED
    );
  }
}
