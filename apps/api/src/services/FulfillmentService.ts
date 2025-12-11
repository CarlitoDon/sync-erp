import { prisma, MovementType } from '@sync-erp/database';
import { InventoryMovement } from '@sync-erp/database';
import { SalesOrderService } from './SalesOrderService';
import { InventoryService } from './InventoryService';

interface FulfillmentInput {
  orderId: string;
  reference?: string;
}

export class FulfillmentService {
  private salesOrderService = new SalesOrderService();
  private inventoryService = new InventoryService();

  /**
   * Process shipment/delivery for a sales order (decreases stock)
   */
  async processShipment(companyId: string, data: FulfillmentInput): Promise<InventoryMovement[]> {
    const order = await this.salesOrderService.getById(data.orderId, companyId);
    if (!order) {
      throw new Error('Sales order not found');
    }

    if (order.status !== 'CONFIRMED') {
      throw new Error('Order must be confirmed before shipping');
    }

    // Delegate to InventoryService (Centralized logic + COGS Journal)
    const movements = await this.inventoryService.processShipment(
      companyId,
      data.orderId,
      data.reference || `Shipment for Order ${order.orderNumber}`
    );

    // Mark order as completed? InventoryService doesn't do it?
    // InventoryService.processShipment does NOT mark order as completed in previous code view.
    // Wait, let's check what I replaced.
    // Replaced logic:
    // 1. check stock
    // 2. create movement
    // 3. decrease stock
    // 4. complete order

    // InventoryService.processShipment (from T007):
    // 1. check stock, find product
    // 2. create movement
    // 3. update stock
    // 4. post journal
    // RETURNS movements.

    // So I need to keep "Mark order as completed" here if InventoryService doesn't do it.
    await this.salesOrderService.complete(data.orderId, companyId);

    return movements;
  }

  /**
   * Get delivery history for an order
   */
  async getDeliveryHistory(orderId: string): Promise<InventoryMovement[]> {
    return prisma.inventoryMovement.findMany({
      where: {
        reference: { contains: orderId },
        type: MovementType.OUT,
      },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
