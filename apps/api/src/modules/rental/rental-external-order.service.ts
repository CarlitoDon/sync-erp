import { DocumentNumberService } from '../common/services/document-number.service.js';
import type {
  RentalIntegrationClaimPaymentInput,
  RentalIntegrationConfirmPaymentInput,
  RentalIntegrationCustomerInput,
  RentalIntegrationRejectPaymentInput,
} from './rental-integration.schemas.js';
import {
  ExternalOrderSecurityService,
  ExternalOrderPartnerService,
  ExternalOrderCatalogService,
  ExternalOrderNotificationService,
  ExternalOrderPaymentService,
  ExternalOrderLifecycleService,
} from './sub-services/index.js';
import type {
  OrderItemComponent,
  CreatePublicOrderInput,
  UpdatePublicOrderInput,
} from './sub-services/index.js';

export type {
  OrderItemComponent,
  CreatePublicOrderInput,
  UpdatePublicOrderInput,
};

/**
 * RentalExternalOrderService
 * Backward-compatible facade coordinating external rental order sub-services.
 */
export class RentalExternalOrderService {
  public readonly securityService: ExternalOrderSecurityService;
  public readonly partnerService: ExternalOrderPartnerService;
  public readonly catalogService: ExternalOrderCatalogService;
  public readonly notificationService: ExternalOrderNotificationService;
  public readonly paymentService: ExternalOrderPaymentService;
  public readonly lifecycleService: ExternalOrderLifecycleService;

  constructor(
    securityService: ExternalOrderSecurityService = new ExternalOrderSecurityService(),
    partnerService: ExternalOrderPartnerService = new ExternalOrderPartnerService(),
    catalogService: ExternalOrderCatalogService = new ExternalOrderCatalogService(),
    notificationService: ExternalOrderNotificationService = new ExternalOrderNotificationService(),
    paymentService?: ExternalOrderPaymentService,
    lifecycleService?: ExternalOrderLifecycleService,
    documentNumberService: DocumentNumberService = new DocumentNumberService()
  ) {
    this.securityService = securityService;
    this.partnerService = partnerService;
    this.catalogService = catalogService;
    this.notificationService = notificationService;
    this.paymentService =
      paymentService ?? new ExternalOrderPaymentService(this.notificationService);
    this.lifecycleService =
      lifecycleService ??
      new ExternalOrderLifecycleService(
        this.securityService,
        this.partnerService,
        this.catalogService,
        this.notificationService,
        documentNumberService
      );
  }

  findOrCreateCustomer(
    companyId: string,
    input: RentalIntegrationCustomerInput
  ) {
    return this.partnerService.findOrCreateCustomer(companyId, input);
  }

  getByToken(token: string) {
    return this.securityService.getByToken(token);
  }

  getById(companyId: string, id: string) {
    return this.lifecycleService.getById(companyId, id);
  }

  getByOrderNumber(companyId: string, orderNumber: string) {
    return this.lifecycleService.getByOrderNumber(companyId, orderNumber);
  }

  createOrder(input: CreatePublicOrderInput) {
    return this.lifecycleService.createOrder(input);
  }

  updateOrder(
    input: UpdatePublicOrderInput,
    expectedCompanyId?: string
  ) {
    return this.lifecycleService.updateOrder(input, expectedCompanyId);
  }

  cancelOrder(input: {
    id: string;
    companyId: string;
    reason?: string;
  }) {
    return this.lifecycleService.cancelOrder(input);
  }

  claimPayment(
    companyId: string,
    input: RentalIntegrationClaimPaymentInput
  ) {
    return this.paymentService.claimPayment(companyId, input);
  }

  confirmPaymentByOrderNumber(
    companyId: string,
    input: RentalIntegrationConfirmPaymentInput
  ) {
    return this.paymentService.confirmPaymentByOrderNumber(companyId, input);
  }

  rejectPaymentByOrderNumber(
    companyId: string,
    input: RentalIntegrationRejectPaymentInput
  ) {
    return this.paymentService.rejectPaymentByOrderNumber(companyId, input);
  }

  deleteOrder(id: string, expectedCompanyId?: string) {
    return this.lifecycleService.deleteOrder(id, expectedCompanyId);
  }
}
