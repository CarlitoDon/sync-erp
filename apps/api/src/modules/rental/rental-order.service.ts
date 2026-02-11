/**
 * Rental Order Service (Facade)
 *
 * Delegates to specialized services for rental order management.
 * Refactored to reduce complexity.
 */

import { RentalOrder, RentalOrderStatus } from '@sync-erp/database';
import { RentalRepository } from './rental.repository';
import { JournalService } from '../accounting/services/journal.service';
import { DocumentNumberService } from '../common/services/document-number.service';
import {
  CreateRentalOrderInput,
  ConfirmRentalOrderInput,
  ManualConfirmRentalOrderInput,
  ReleaseRentalOrderInput,
  PrismaRentalOrderWithRelations,
} from '@sync-erp/shared';
import { RentalWebhookService } from './rental-webhook.service';
import { RentalOrderLifecycleService } from './rental-order-lifecycle.service';
import { RentalOrderFulfillmentService } from './rental-order-fulfillment.service';
import { RentalOrderPaymentService } from './rental-order-payment.service';

export class RentalOrderService {
  private readonly lifecycleService: RentalOrderLifecycleService;
  private readonly fulfillmentService: RentalOrderFulfillmentService;
  private readonly paymentService: RentalOrderPaymentService;

  constructor(
    repository: RentalRepository = new RentalRepository(),
    documentNumberService: DocumentNumberService = new DocumentNumberService(),
    webhookService?: RentalWebhookService,
    journalService: JournalService = new JournalService()
  ) {
    this.lifecycleService = new RentalOrderLifecycleService(
      repository,
      documentNumberService,
      journalService
    );
    this.fulfillmentService = new RentalOrderFulfillmentService(
      repository,
      journalService
    );
    this.paymentService = new RentalOrderPaymentService(
      webhookService
    );
  }

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
    return this.lifecycleService.listOrders(companyId, filters);
  }

  async getOrderById(
    companyId: string,
    id: string
  ): Promise<PrismaRentalOrderWithRelations | null> {
    return this.lifecycleService.getOrderById(companyId, id);
  }

  async createOrder(
    companyId: string,
    data: CreateRentalOrderInput,
    userId: string
  ): Promise<PrismaRentalOrderWithRelations> {
    return this.lifecycleService.createOrder(companyId, data, userId);
  }

  async cancelOrder(
    companyId: string,
    orderId: string,
    reason: string,
    userId: string
  ): Promise<RentalOrder> {
    return this.lifecycleService.cancelOrder(
      companyId,
      orderId,
      reason,
      userId
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
    return this.lifecycleService.extendOrder(
      companyId,
      input,
      userId
    );
  }

  async confirmOrder(
    companyId: string,
    input: ConfirmRentalOrderInput,
    userId: string
  ): Promise<RentalOrder> {
    return this.fulfillmentService.confirmOrder(
      companyId,
      input,
      userId
    );
  }

  async manualConfirmOrder(
    companyId: string,
    input: ManualConfirmRentalOrderInput,
    userId: string
  ): Promise<RentalOrder> {
    return this.fulfillmentService.manualConfirmOrder(
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
    return this.fulfillmentService.releaseOrder(
      companyId,
      input,
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
    return this.paymentService.verifyPayment(
      companyId,
      orderId,
      action,
      userId,
      paymentReference,
      failReason
    );
  }
}
