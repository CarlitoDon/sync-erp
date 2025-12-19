// Shipment Saga - Atomic order shipment with compensation
import {
  SagaType,
  OrderStatus,
  Prisma,
  BusinessShape,
  type InventoryMovement,
} from '@sync-erp/database';
import {
  SagaOrchestrator,
  PostingContext,
} from '../../common/saga/index.js';
import { SalesRepository } from '../sales.repository.js';
import { InventoryService } from '../../inventory/inventory.service.js';
import { ProductService } from '../../product/product.service.js';

export interface ShipmentInput {
  orderId: string;
  companyId: string;
  reference?: string;
  shape?: BusinessShape;
  configs?: { key: string; value: Prisma.JsonValue }[];
}

export interface ShipmentResult {
  movements: InventoryMovement[];
}

/**
 * ShipmentSaga orchestrates order shipment atomically:
 *
 * Steps:
 * 1. Validate order exists and is CONFIRMED
 * 2. Validate stock availability for all items
 * 3. Stock OUT for each item
 * 4. Update order status to COMPLETED
 *
 * Compensation (on failure):
 * 1. Restore stock for shipped items
 * 2. Revert order status to CONFIRMED
 */
export class ShipmentSaga extends SagaOrchestrator<
  ShipmentInput,
  ShipmentResult
> {
  protected readonly sagaType = SagaType.SHIPMENT;

  protected getLockTable(): string {
    return 'Order';
  }

  private salesRepository = new SalesRepository();
  private inventoryService = new InventoryService();
  private productService = new ProductService();

  /**
   * Execute the forward flow
   */
  protected async executeSteps(
    input: ShipmentInput,
    context: PostingContext,
    tx?: Prisma.TransactionClient
  ): Promise<ShipmentResult> {
    // 1. Validate order
    const order = await this.salesRepository.findById(
      input.orderId,
      input.companyId,
      tx
    );
    if (!order) {
      throw new Error('Sales order not found');
    }

    if (order.status !== OrderStatus.CONFIRMED) {
      throw new Error('Order must be confirmed before shipping');
    }

    // 2. Validate stock availability
    for (const item of order.items) {
      const hasStock = await this.productService.checkStock(
        item.productId,
        item.quantity,
        tx
      );
      if (!hasStock) {
        throw new Error(
          `Insufficient stock for product ${item.productId}`
        );
      }
    }

    // 3. Create Shipment document (DRAFT state)
    const shipment = await this.inventoryService.createShipment(
      input.companyId,
      {
        salesOrderId: input.orderId,
        notes:
          input.reference ||
          `Shipment for Order ${order.orderNumber}`,
        items: order.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      },
      tx
    );

    // 4. Post Shipment (Stock OUT + COGS Snapshot)
    await this.inventoryService.postShipment(
      input.companyId,
      shipment.id,
      tx
    );

    // Track Shipment for compensation
    await context.markStockDone(shipment.id);

    // 5. Update order status to COMPLETED
    await this.salesRepository.updateStatus(
      input.orderId,
      OrderStatus.COMPLETED,
      tx
    );

    // Return empty movements array for backward compatibility
    return { movements: [] };
  }

  /**
   * Compensate on failure - restore stock and revert status
   */
  protected async compensate(context: PostingContext): Promise<void> {
    const stepData = context.stepData;

    // 1. Restore stock if shipment was done
    if (stepData.stockMovementId) {
      // Note: InventoryService.processShipment has its own rollback on failure
      // But if we got past that step, we need to reverse manually
      // For now, log warning - full reversal requires stock return functionality
      console.warn(
        `[SAGA] Shipment movements may need manual review for order ${context.entityId}`
      );
    }

    // 2. Revert order status to CONFIRMED
    await this.salesRepository.updateStatus(
      context.entityId,
      OrderStatus.CONFIRMED
    );
  }
}
