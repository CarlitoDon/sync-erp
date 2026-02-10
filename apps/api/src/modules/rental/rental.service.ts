/**
 * Rental Service (Facade)
 *
 * This service acts as a facade, delegating to specialized sub-services:
 * - RentalItemService: Item and unit management
 * - RentalOrderService: Order lifecycle management
 * - RentalReturnService: Return processing and settlement
 * - RentalPolicyService: Policy configuration
 *
 * This refactoring improves maintainability by breaking the original 2,120-line
 * file into focused, testable sub-services while maintaining backward compatibility.
 */

import { prisma } from '@sync-erp/database';
import {
  RentalItem,
  RentalItemUnit,
  RentalOrder,
  RentalOrderStatus,
  RentalReturn,
  RentalPolicy,
  UnitStatus,
} from '@sync-erp/database';
import { RentalItemService } from './rental-item.service';
import { RentalOrderService } from './rental-order.service';
import { RentalReturnService } from './rental-return.service';
import { RentalPolicyService } from './rental-policy.service';
import { RentalWebhookService } from './rental-webhook.service';
import { RentalExternalOrderService } from './rental-external-order.service';
import {
  type CreateRentalItemInput,
  type CreateRentalOrderInput,
  type ConfirmRentalOrderInput,
  type ManualConfirmRentalOrderInput,
  type ReleaseRentalOrderInput,
  type ProcessReturnInput,
  type RentalItemWithRelations,
  type PrismaRentalOrderWithRelations,
} from '@sync-erp/shared';

export { Prisma } from '@sync-erp/database';

export class RentalService {
  private readonly itemService: RentalItemService;
  private readonly orderService: RentalOrderService;
  private readonly returnService: RentalReturnService;
  private readonly policyService: RentalPolicyService;
  public readonly externalOrderService: RentalExternalOrderService;

  constructor(webhookService?: RentalWebhookService) {
    this.itemService = new RentalItemService();
    this.orderService = new RentalOrderService(
      undefined,
      undefined,
      webhookService
    );
    this.returnService = new RentalReturnService();
    this.policyService = new RentalPolicyService();
    this.externalOrderService = new RentalExternalOrderService();
  }

  // ==========================================
  // Item Management (delegated to RentalItemService)
  // ==========================================

  async listItems(
    companyId: string,
    filters?: { isActive?: boolean }
  ): Promise<RentalItemWithRelations[]> {
    return this.itemService.listItems(companyId, filters);
  }

  async createItem(
    companyId: string,
    data: CreateRentalItemInput,
    userId: string
  ): Promise<RentalItem> {
    return this.itemService.createItem(companyId, data, userId);
  }

  async convertStockToUnits(
    companyId: string,
    itemId: string,
    quantity: number,
    userId: string
  ): Promise<number> {
    return this.itemService.convertStockToUnits(
      companyId,
      itemId,
      quantity,
      userId
    );
  }

  async updateUnitStatus(
    companyId: string,
    unitId: string,
    status: UnitStatus,
    reason?: string,
    userId?: string
  ): Promise<RentalItemUnit> {
    return this.itemService.updateUnitStatus(
      companyId,
      unitId,
      status,
      reason,
      userId
    );
  }

  async checkAvailability(
    companyId: string,
    startDate: Date,
    endDate: Date,
    itemId?: string
  ): Promise<Record<string, number>> {
    return this.itemService.checkAvailability(
      companyId,
      startDate,
      endDate,
      itemId
    );
  }

  async getUnitsByItem(
    companyId: string,
    itemId: string,
    status?: UnitStatus
  ): Promise<RentalItemUnit[]> {
    return this.itemService.getUnitsByItem(companyId, itemId, status);
  }

  // ==========================================
  // Order Management (delegated to RentalOrderService)
  // ==========================================

  async listOrders(
    companyId: string,
    filters?: {
      status?: RentalOrderStatus;
      partnerId?: string;
      dateRange?: { start: Date; end: Date };
      take?: number;
      cursor?: string;
    }
  ): Promise<{
    items: PrismaRentalOrderWithRelations[];
    nextCursor: string | null;
  }> {
    return this.orderService.listOrders(companyId, filters);
  }

  async createOrder(
    companyId: string,
    data: CreateRentalOrderInput,
    userId: string
  ): Promise<PrismaRentalOrderWithRelations> {
    return this.orderService.createOrder(companyId, data, userId);
  }

  async getOrderById(
    companyId: string,
    id: string
  ): Promise<PrismaRentalOrderWithRelations | null> {
    return this.orderService.getOrderById(companyId, id);
  }

  async confirmOrder(
    companyId: string,
    input: ConfirmRentalOrderInput,
    userId: string
  ): Promise<RentalOrder> {
    return this.orderService.confirmOrder(companyId, input, userId);
  }

  async manualConfirmOrder(
    companyId: string,
    input: ManualConfirmRentalOrderInput,
    userId: string
  ): Promise<RentalOrder> {
    return this.orderService.manualConfirmOrder(
      companyId,
      input,
      userId
    );
  }

  async releaseOrder(
    companyId: string,
    input: ReleaseRentalOrderInput,
    userId: string
  ): Promise<RentalOrder> {
    return this.orderService.releaseOrder(companyId, input, userId);
  }

  async cancelOrder(
    companyId: string,
    orderId: string,
    reason: string,
    userId: string
  ): Promise<RentalOrder> {
    return this.orderService.cancelOrder(
      companyId,
      orderId,
      reason,
      userId
    );
  }

  async verifyPayment(
    companyId: string,
    orderId: string,
    action: 'confirm' | 'reject',
    userId: string,
    paymentReference?: string,
    failReason?: string
  ): Promise<RentalOrder> {
    return this.orderService.verifyPayment(
      companyId,
      orderId,
      action,
      userId,
      paymentReference,
      failReason
    );
  }

  async extendOrder(
    companyId: string,
    input: {
      orderId: string;
      newEndDate: Date;
      additionalDeposit?: number;
      reason?: string;
    },
    userId: string
  ): Promise<RentalOrder> {
    return this.orderService.extendOrder(companyId, input, userId);
  }

  // ==========================================
  // Return Processing (delegated to RentalReturnService)
  // ==========================================

  async processReturn(
    companyId: string,
    input: ProcessReturnInput,
    userId: string
  ): Promise<RentalReturn> {
    return this.returnService.processReturn(companyId, input, userId);
  }

  async finalizeReturn(
    companyId: string,
    returnId: string,
    userId: string
  ): Promise<RentalReturn> {
    return this.returnService.finalizeReturn(
      companyId,
      returnId,
      userId
    );
  }

  async createInvoiceFromReturn(companyId: string, returnId: string) {
    return this.returnService.createInvoiceFromReturn(
      companyId,
      returnId
    );
  }

  // ==========================================
  // Policy Management (delegated to RentalPolicyService)
  // ==========================================

  async getCurrentPolicy(
    companyId: string
  ): Promise<RentalPolicy | null> {
    return this.policyService.getCurrentPolicy(companyId);
  }

  async updatePolicy(
    companyId: string,
    data: {
      gracePeriodHours?: number;
      lateFeeDailyRate?: number;
      cleaningFee?: number;
      pickupGracePeriodHours?: number;
    },
    userId: string
  ): Promise<RentalPolicy> {
    return this.policyService.updatePolicy(companyId, data, userId);
  }

  // ==========================================
  // Scheduler / Timeline (complex query - kept in facade)
  // ==========================================

  async getSchedulerTimeline(
    companyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    items: Array<{
      id: string;
      name: string;
      units: Array<{
        id: string;
        unitCode: string;
        status: string;
        bookings: Array<{
          orderId: string;
          orderNumber: string;
          partnerName: string;
          startDate: Date;
          endDate: Date;
          status: string;
        }>;
      }>;
    }>;
  }> {
    // Fetch rental items with units
    const items = await prisma.rentalItem.findMany({
      where: { companyId },
      include: {
        product: { select: { name: true } },
        units: {
          orderBy: { unitCode: 'asc' },
        },
      },
    });

    // Fetch orders that overlap with the date range
    const orders = await prisma.rentalOrder.findMany({
      where: {
        companyId,
        status: {
          in: [RentalOrderStatus.CONFIRMED, RentalOrderStatus.ACTIVE],
        },
        OR: [
          {
            rentalStartDate: { lte: endDate },
            rentalEndDate: { gte: startDate },
          },
        ],
      },
      include: {
        partner: { select: { name: true } },
        unitAssignments: {
          select: { rentalItemUnitId: true },
        },
      },
    });

    // Create a map of unit -> bookings
    const unitBookings = new Map<
      string,
      Array<{
        orderId: string;
        orderNumber: string;
        partnerName: string;
        startDate: Date;
        endDate: Date;
        status: string;
      }>
    >();

    for (const order of orders) {
      for (const assignment of order.unitAssignments) {
        const unitId = assignment.rentalItemUnitId;
        if (!unitBookings.has(unitId)) {
          unitBookings.set(unitId, []);
        }
        unitBookings.get(unitId)!.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          partnerName: order.partner?.name || 'Unknown',
          startDate: order.rentalStartDate,
          endDate: order.rentalEndDate,
          status: order.status,
        });
      }
    }

    // Build the response
    return {
      items: items.map((item) => ({
        id: item.id,
        name: item.product?.name || 'Unknown',
        units: item.units.map((unit) => ({
          id: unit.id,
          unitCode: unit.unitCode,
          status: unit.status,
          bookings: unitBookings.get(unit.id) || [],
        })),
      })),
    };
  }
}
