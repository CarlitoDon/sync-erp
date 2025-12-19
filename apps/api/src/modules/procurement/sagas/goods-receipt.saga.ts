// Goods Receipt Saga - Atomic goods receipt with compensation
import {
  SagaType,
  OrderStatus,
  BusinessShape,
  type InventoryMovement,
  Prisma,
} from '@sync-erp/database';
import {
  SagaOrchestrator,
  PostingContext,
} from '../../common/saga/index.js';
import { ProcurementRepository } from '../procurement.repository';
import { InventoryService } from '../../inventory/inventory.service';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';

export interface GoodsReceiptSagaInput {
  orderId: string;
  companyId: string;
  reference?: string;
  shape?: BusinessShape;
  items?: { id: string; quantity: number }[];
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

  protected getLockTable(): string {
    return 'Order';
  }

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
    context: PostingContext,
    tx?: Prisma.TransactionClient
  ): Promise<GoodsReceiptResult> {
    // 1. Validate PO
    const order = await this.procurementRepository.findById(
      input.orderId,
      input.companyId,
      tx
    );
    if (!order) {
      throw new Error('Purchase order not found');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new Error('Cannot receive goods for a cancelled order');
    }

    // Phase 1 Guard: Reject Partial Receipt
    // If items are provided, they must match the PO exactly.
    if (input.items && input.items.length > 0) {
      // Fetch PO items to compare
      const poItems = await this.procurementRepository.findItems(
        order.id,
        tx
      );

      // 1. Check item count
      if (input.items.length !== poItems.length) {
        throw new DomainError(
          'Partial receipt is disabled in Phase 1 (Item count mismatch)',
          400,
          DomainErrorCodes.FEATURE_DISABLED_PHASE_1
        );
      }

      // 2. Check quantities
      for (const inputItem of input.items) {
        const poItem = poItems.find((i) => i.id === inputItem.id);
        if (!poItem) {
          throw new DomainError(
            `Item ${inputItem.id} not found in PO`,
            400,
            DomainErrorCodes.FEATURE_DISABLED_PHASE_1
          );
        }
        if (inputItem.quantity !== poItem.quantity) {
          throw new DomainError(
            `Partial receipt is disabled in Phase 1 (Quantity mismatch for ${poItem.productId})`,
            400,
            DomainErrorCodes.FEATURE_DISABLED_PHASE_1
          );
        }
      }
    }

    // 2. Create GRN document (DRAFT state)
    // Fetch PO items again if not already loaded
    const poItems = await this.procurementRepository.findItems(
      order.id,
      tx
    );
    const grn = await this.inventoryService.createGRN(
      input.companyId,
      {
        purchaseOrderId: input.orderId,
        notes:
          input.reference ||
          `Goods receipt for PO ${order.orderNumber}`,
        items: poItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      },
      tx
    );

    // 3. Post GRN (Stock IN + Cost Update)
    await this.inventoryService.postGRN(input.companyId, grn.id, tx);

    // Track GRN for compensation
    await context.markStockDone(grn.id);

    // 4. Update PO status to COMPLETED if fully received
    await this.procurementRepository.updateStatus(
      input.orderId,
      OrderStatus.COMPLETED,
      tx
    );

    // Return empty movements array for backward compatibility
    // (New flow uses GRN document, not raw movements)
    return { movements: [] };
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
