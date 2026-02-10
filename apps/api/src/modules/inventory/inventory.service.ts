/**
 * Inventory Service (Facade)
 *
 * This service acts as a facade, delegating to specialized sub-services:
 * - InventoryMovementService: Stock adjustments and movement tracking
 * - InventoryFulfillmentService: GRN, Shipments, and Returns
 *
 * This refactoring improves maintainability by breaking the original 1,200-line
 * file into focused, testable sub-services while maintaining backward compatibility.
 */

import {
  InventoryMovement,
  BusinessShape,
  Prisma,
  FulfillmentType,
} from '@sync-erp/database';
import { InventoryRepository } from './inventory.repository';
import { ProductService } from '../product/product.service';
import { JournalService } from '../accounting/services/journal.service';
import { InventoryMovementService } from './inventory-movement.service';
import { InventoryFulfillmentService } from './inventory-fulfillment.service';
import { StockAdjustmentInput } from '@sync-erp/shared';

export class InventoryService {
  private readonly movementService: InventoryMovementService;
  private readonly fulfillmentService: InventoryFulfillmentService;

  constructor(
    repository: InventoryRepository = new InventoryRepository(),
    productService: ProductService = new ProductService(),
    journalService: JournalService = new JournalService()
  ) {
    this.movementService = new InventoryMovementService(
      repository,
      productService,
      journalService
    );
    this.fulfillmentService = new InventoryFulfillmentService(
      repository,
      productService,
      journalService
    );
  }

  // ==========================================
  // Movement Methods (delegated to InventoryMovementService)
  // ==========================================

  async getMovements(
    companyId: string,
    productId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<InventoryMovement[]> {
    return this.movementService.getMovements(
      companyId,
      productId,
      tx
    );
  }

  async getStockLevels(
    companyId: string,
    tx?: Prisma.TransactionClient
  ) {
    return this.movementService.getStockLevels(companyId, tx);
  }

  async adjustStock(
    companyId: string,
    data: StockAdjustmentInput,
    shape?: BusinessShape,
    configs?: { key: string; value: Prisma.JsonValue }[],
    tx?: Prisma.TransactionClient
  ): Promise<InventoryMovement> {
    return this.movementService.adjustStock(
      companyId,
      data,
      shape,
      configs,
      tx
    );
  }

  // ==========================================
  // Fulfillment Methods (delegated to InventoryFulfillmentService)
  // ==========================================

  async createFulfillment(
    companyId: string,
    data: {
      orderId: string;
      type: FulfillmentType;
      date?: string;
      notes?: string;
      receivedBy?: string;
      items: { productId: string; quantity: number }[];
    },
    tx?: Prisma.TransactionClient
  ) {
    return this.fulfillmentService.createFulfillment(
      companyId,
      data,
      tx
    );
  }

  async postFulfillment(
    companyId: string,
    fulfillmentId: string,
    tx?: Prisma.TransactionClient,
    userId?: string
  ) {
    return this.fulfillmentService.postFulfillment(
      companyId,
      fulfillmentId,
      tx,
      userId
    );
  }

  async voidFulfillment(
    companyId: string,
    fulfillmentId: string,
    reason: string,
    tx?: Prisma.TransactionClient,
    userId?: string,
    userPermissions?: string[]
  ) {
    return this.fulfillmentService.voidFulfillment(
      companyId,
      fulfillmentId,
      reason,
      tx,
      userId,
      userPermissions
    );
  }

  async listFulfillments(
    companyId: string,
    type?: FulfillmentType,
    tx?: Prisma.TransactionClient
  ) {
    return this.fulfillmentService.listFulfillments(
      companyId,
      type,
      tx
    );
  }

  async getFulfillment(
    companyId: string,
    fulfillmentId: string,
    tx?: Prisma.TransactionClient
  ) {
    return this.fulfillmentService.getFulfillment(
      companyId,
      fulfillmentId,
      tx
    );
  }

  async deleteFulfillment(
    companyId: string,
    fulfillmentId: string,
    tx?: Prisma.TransactionClient
  ) {
    return this.fulfillmentService.deleteFulfillment(
      companyId,
      fulfillmentId,
      tx
    );
  }

  // ==========================================
  // GRN Methods
  // ==========================================

  async createGRN(
    companyId: string,
    data: {
      purchaseOrderId: string;
      date?: string;
      notes?: string;
      items: { productId: string; quantity: number }[];
    },
    tx?: Prisma.TransactionClient
  ) {
    return this.fulfillmentService.createGRN(companyId, data, tx);
  }

  async postGRN(
    companyId: string,
    grnId: string,
    tx?: Prisma.TransactionClient,
    userId?: string
  ) {
    return this.fulfillmentService.postGRN(
      companyId,
      grnId,
      tx,
      userId
    );
  }

  async listGRN(companyId: string) {
    return this.fulfillmentService.listGRN(companyId);
  }

  async getGRN(companyId: string, grnId: string) {
    return this.fulfillmentService.getGRN(companyId, grnId);
  }

  async voidGRN(
    companyId: string,
    grnId: string,
    reason: string,
    tx?: Prisma.TransactionClient,
    userId?: string,
    userPermissions?: string[]
  ) {
    return this.fulfillmentService.voidGRN(
      companyId,
      grnId,
      reason,
      tx,
      userId,
      userPermissions
    );
  }

  async deleteGRN(
    companyId: string,
    grnId: string,
    tx?: Prisma.TransactionClient
  ) {
    return this.fulfillmentService.deleteGRN(companyId, grnId, tx);
  }

  // ==========================================
  // Shipment Methods
  // ==========================================

  async createShipment(
    companyId: string,
    data: {
      salesOrderId: string;
      date?: string;
      notes?: string;
      items: { productId: string; quantity: number }[];
    },
    tx?: Prisma.TransactionClient
  ) {
    return this.fulfillmentService.createShipment(
      companyId,
      data,
      tx
    );
  }

  async postShipment(
    companyId: string,
    shipmentId: string,
    tx?: Prisma.TransactionClient
  ) {
    return this.fulfillmentService.postShipment(
      companyId,
      shipmentId,
      tx
    );
  }

  async listShipments(companyId: string) {
    return this.fulfillmentService.listShipments(companyId);
  }

  async getShipment(companyId: string, shipmentId: string) {
    return this.fulfillmentService.getShipment(companyId, shipmentId);
  }

  async voidShipment(
    companyId: string,
    shipmentId: string,
    reason: string,
    tx?: Prisma.TransactionClient,
    userId?: string,
    userPermissions?: string[]
  ) {
    return this.fulfillmentService.voidShipment(
      companyId,
      shipmentId,
      reason,
      tx,
      userId,
      userPermissions
    );
  }

  async deleteShipment(
    companyId: string,
    shipmentId: string,
    tx?: Prisma.TransactionClient
  ) {
    return this.fulfillmentService.deleteShipment(
      companyId,
      shipmentId,
      tx
    );
  }

  // ==========================================
  // Sales Return Methods
  // ==========================================

  async createReturn(
    companyId: string,
    data: {
      salesOrderId: string;
      date?: string;
      notes?: string;
      items: { productId: string; quantity: number }[];
    },
    tx?: Prisma.TransactionClient
  ) {
    return this.fulfillmentService.createReturn(companyId, data, tx);
  }

  async postReturn(
    companyId: string,
    returnId: string,
    tx?: Prisma.TransactionClient,
    userId?: string
  ) {
    return this.fulfillmentService.postReturn(
      companyId,
      returnId,
      tx,
      userId
    );
  }

  async listReturns(companyId: string) {
    return this.fulfillmentService.listReturns(companyId);
  }

  // ==========================================
  // Purchase Return Methods
  // ==========================================

  async createPurchaseReturn(
    companyId: string,
    data: {
      purchaseOrderId: string;
      items: { productId: string; quantity: number }[];
      date?: string;
      notes?: string;
    },
    tx?: Prisma.TransactionClient
  ) {
    return this.fulfillmentService.createPurchaseReturn(
      companyId,
      data,
      tx
    );
  }

  async postPurchaseReturn(
    companyId: string,
    returnId: string,
    tx?: Prisma.TransactionClient,
    userId?: string
  ) {
    return this.fulfillmentService.postPurchaseReturn(
      companyId,
      returnId,
      tx,
      userId
    );
  }

  async listPurchaseReturns(companyId: string) {
    return this.fulfillmentService.listPurchaseReturns(companyId);
  }
}
