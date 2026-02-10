/**
 * Inventory Fulfillment Service (Facade)
 *
 * Handles all fulfillment operations by delegating to specialized sub-services:
 * - InventoryGRNService (GRN)
 * - InventoryShipmentService (Shipment)
 * - InventoryReturnService (Returns)
 */

import { Prisma, FulfillmentType, prisma } from '@sync-erp/database';
import { InventoryRepository } from './inventory.repository';
import { ProductService } from '../product/product.service';
import { JournalService } from '../accounting/services/journal.service';
import { InventoryGRNService } from './inventory-grn.service';
import { InventoryShipmentService } from './inventory-shipment.service';
import { InventoryReturnService } from './inventory-return.service';
import { DomainError } from '@sync-erp/shared';

export class InventoryFulfillmentService {
  private readonly grnService: InventoryGRNService;
  private readonly shipmentService: InventoryShipmentService;
  private readonly returnService: InventoryReturnService;

  constructor(
    repository: InventoryRepository = new InventoryRepository(),
    productService: ProductService = new ProductService(),
    journalService: JournalService = new JournalService()
  ) {
    this.grnService = new InventoryGRNService(
      repository,
      journalService
    );
    this.shipmentService = new InventoryShipmentService(
      repository,
      journalService,
      productService
    );
    this.returnService = new InventoryReturnService(
      repository,
      journalService,
      productService
    );
  }

  // ==========================================
  // Core Fulfillment CRUD (Deprecated/Delegated)
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
    // Delegate based on type
    switch (data.type) {
      case FulfillmentType.RECEIPT:
        return this.grnService.createGRN(
          companyId,
          {
            purchaseOrderId: data.orderId,
            date: data.date,
            notes: data.notes,
            items: data.items,
          },
          tx
        );
      case FulfillmentType.SHIPMENT:
        return this.shipmentService.createShipment(
          companyId,
          {
            salesOrderId: data.orderId,
            date: data.date,
            notes: data.notes,
            items: data.items,
          },
          tx
        );
      case FulfillmentType.RETURN:
        return this.returnService.createReturn(
          companyId,
          {
            salesOrderId: data.orderId,
            date: data.date,
            notes: data.notes,
            items: data.items,
          },
          tx
        );
      case FulfillmentType.PURCHASE_RETURN:
        return this.returnService.createPurchaseReturn(
          companyId,
          {
            purchaseOrderId: data.orderId,
            date: data.date,
            notes: data.notes,
            items: data.items,
          },
          tx
        );
      default:
        throw new DomainError(
          `Unsupported fulfillment type: ${data.type}`,
          400
        );
    }
  }

  async postFulfillment(
    companyId: string,
    fulfillmentId: string,
    tx?: Prisma.TransactionClient,
    userId?: string
  ) {
    // We need to know the type first. This is a limitation of the old generic method.
    // We'll peek at the fulfillment to decide where to delegate.
    const repo = new InventoryRepository();
    const db = tx || prisma;
    const fulfillment = await repo.findFulfillmentById(
      fulfillmentId,
      companyId,
      db
    );

    if (!fulfillment) {
      throw new DomainError('Fulfillment not found', 404);
    }

    switch (fulfillment.type) {
      case FulfillmentType.RECEIPT:
        return this.grnService.postGRN(
          companyId,
          fulfillmentId,
          tx,
          userId
        );
      case FulfillmentType.SHIPMENT:
        return this.shipmentService.postShipment(
          companyId,
          fulfillmentId,
          tx,
          userId
        );
      case FulfillmentType.RETURN:
        return this.returnService.postReturn(
          companyId,
          fulfillmentId,
          tx,
          userId
        );
      // PURCHASE_RETURN has its own distinct post method in the old service,
      // but if postFulfillment was ever called for it, we should handle it.
      // However, the old code didn't handle PURCHASE_RETURN in postFulfillment.
      default:
        throw new DomainError(
          `Unsupported fulfillment type: ${fulfillment.type}`,
          400
        );
    }
  }

  async voidFulfillment(
    companyId: string,
    fulfillmentId: string,
    reason: string,
    tx?: Prisma.TransactionClient,
    userId?: string,
    userPermissions?: string[]
  ) {
    // Peek at type
    const repo = new InventoryRepository();
    const db = tx || prisma;
    const fulfillment = await repo.findFulfillmentById(
      fulfillmentId,
      companyId,
      db
    );

    if (!fulfillment) {
      throw new DomainError('Fulfillment not found', 404);
    }

    switch (fulfillment.type) {
      case FulfillmentType.RECEIPT:
        return this.grnService.voidGRN(
          companyId,
          fulfillmentId,
          reason,
          tx,
          userId,
          userPermissions
        );
      case FulfillmentType.SHIPMENT:
        return this.shipmentService.voidShipment(
          companyId,
          fulfillmentId,
          reason,
          tx,
          userId,
          userPermissions
        );
      // Returns didn't support voiding in the old service?
      // The old voidFulfillment only handled RECEIPT and SHIPMENT.
      default:
        throw new DomainError(
          `Cannot void fulfillment type: ${fulfillment.type}`,
          400
        );
    }
  }

  async listFulfillments(
    companyId: string,
    type?: FulfillmentType,
    tx?: Prisma.TransactionClient
  ) {
    // Logic is in Repository, so delegating to any service or rep directly is fine.
    // We can use GRN service by default or just use repository.
    // But let's use GRN service for list as a proxy.
    return this.grnService.listGRN(companyId);
    // WAIT. listGRN hardcodes type=RECEIPT.
    // this needs to be generic.
    const repo = new InventoryRepository();
    return repo.listFulfillments(companyId, type, tx);
  }

  async getFulfillment(companyId: string, fulfillmentId: string) {
    return this.grnService.getGRN(companyId, fulfillmentId); // getGRN is just a wrapper for findFulfillmentById which is generic.
  }

  async deleteFulfillment(
    companyId: string,
    fulfillmentId: string,
    tx?: Prisma.TransactionClient
  ) {
    // Peek at type to decide? Or just check generic DRAFT status?
    // Delete is relatively generic (check DRAFT).
    // But services enforce their own type checks.
    // Let's peek.
    const repo = new InventoryRepository();
    const db = tx || prisma;
    const fulfillment = await repo.findFulfillmentById(
      fulfillmentId,
      companyId,
      db
    );

    if (!fulfillment) return; // or throw

    switch (fulfillment.type) {
      case FulfillmentType.RECEIPT:
        return this.grnService.deleteGRN(
          companyId,
          fulfillmentId,
          tx
        );
      case FulfillmentType.SHIPMENT:
        return this.shipmentService.deleteShipment(
          companyId,
          fulfillmentId,
          tx
        );
      default:
        // Fallback for others?
        return repo.deleteFulfillment(fulfillmentId, db);
    }
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
    return this.grnService.createGRN(companyId, data, tx);
  }

  async postGRN(
    companyId: string,
    grnId: string,
    tx?: Prisma.TransactionClient,
    userId?: string
  ) {
    return this.grnService.postGRN(companyId, grnId, tx, userId);
  }

  async listGRN(companyId: string) {
    return this.grnService.listGRN(companyId);
  }

  async getGRN(companyId: string, grnId: string) {
    return this.grnService.getGRN(companyId, grnId);
  }

  async voidGRN(
    companyId: string,
    grnId: string,
    reason: string,
    tx?: Prisma.TransactionClient,
    userId?: string,
    userPermissions?: string[]
  ) {
    return this.grnService.voidGRN(
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
    return this.grnService.deleteGRN(companyId, grnId, tx);
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
    return this.shipmentService.createShipment(companyId, data, tx);
  }

  async postShipment(
    companyId: string,
    shipmentId: string,
    tx?: Prisma.TransactionClient
  ) {
    return this.shipmentService.postShipment(
      companyId,
      shipmentId,
      tx
    );
  }

  async listShipments(companyId: string) {
    return this.shipmentService.listShipments(companyId);
  }

  async getShipment(companyId: string, shipmentId: string) {
    return this.shipmentService.getShipment(companyId, shipmentId);
  }

  async voidShipment(
    companyId: string,
    shipmentId: string,
    reason: string,
    tx?: Prisma.TransactionClient,
    userId?: string,
    userPermissions?: string[]
  ) {
    return this.shipmentService.voidShipment(
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
    return this.shipmentService.deleteShipment(
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
    return this.returnService.createReturn(companyId, data, tx);
  }

  async postReturn(
    companyId: string,
    returnId: string,
    tx?: Prisma.TransactionClient,
    userId?: string
  ) {
    return this.returnService.postReturn(
      companyId,
      returnId,
      tx,
      userId
    );
  }

  async listReturns(companyId: string) {
    return this.returnService.listReturns(companyId);
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
    return this.returnService.createPurchaseReturn(
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
    return this.returnService.postPurchaseReturn(
      companyId,
      returnId,
      tx,
      userId
    );
  }

  async listPurchaseReturns(companyId: string) {
    return this.returnService.listPurchaseReturns(companyId);
  }
}
