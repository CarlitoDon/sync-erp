import { describe, expect, it, vi } from 'vitest';
import { DomainError, DomainErrorCodes } from '@sync-erp/shared';
import type { JournalEntry } from '@sync-erp/database';
import { RentalExternalOrderService } from '../../src/modules/rental/rental-external-order.service.js';
import {
  ExternalOrderSecurityService,
  ExternalOrderPartnerService,
  ExternalOrderCatalogService,
  ExternalOrderNotificationService,
  ExternalOrderPaymentService,
  ExternalOrderLifecycleService,
} from '../../src/modules/rental/sub-services/index.js';
import type {
  CreatePublicOrderInput,
  UpdatePublicOrderInput,
} from '../../src/modules/rental/sub-services/index.js';
import type {
  RentalIntegrationClaimPaymentInput,
  RentalIntegrationConfirmPaymentInput,
  RentalIntegrationCustomerInput,
  RentalIntegrationRejectPaymentInput,
} from '../../src/modules/rental/rental-integration.schemas.js';
import { JournalService } from '../../src/modules/accounting/services/journal.service.js';
import { JournalCoreService } from '../../src/modules/accounting/services/journal-core.service.js';
import { JournalSalesService } from '../../src/modules/accounting/services/journal-sales.service.js';
import { JournalProcurementService } from '../../src/modules/accounting/services/journal-procurement.service.js';
import { JournalRentalService } from '../../src/modules/accounting/services/journal-rental.service.js';
import { JournalInventoryService } from '../../src/modules/accounting/services/journal-inventory.service.js';
import { JournalAccountResolver } from '../../src/modules/accounting/services/journal-account-resolver.service.js';
import { JournalRentalLegacyService } from '../../src/modules/accounting/services/journal-rental-legacy.service.js';
import { JournalRepository } from '../../src/modules/accounting/repositories/journal.repository.js';
import { AccountService } from '../../src/modules/accounting/services/account.service.js';

describe('Milestone M4 Adversarial Challenger: Facade & Sub-Service Verification', () => {
  describe('1. Instantiation Verification (Zero-Argument Constructor)', () => {
    it('instantiates RentalExternalOrderService with zero arguments without throwing', () => {
      const facade = new RentalExternalOrderService();
      expect(facade).toBeInstanceOf(RentalExternalOrderService);
      expect(facade.securityService).toBeInstanceOf(ExternalOrderSecurityService);
      expect(facade.partnerService).toBeInstanceOf(ExternalOrderPartnerService);
      expect(facade.catalogService).toBeInstanceOf(ExternalOrderCatalogService);
      expect(facade.notificationService).toBeInstanceOf(ExternalOrderNotificationService);
      expect(facade.paymentService).toBeInstanceOf(ExternalOrderPaymentService);
      expect(facade.lifecycleService).toBeInstanceOf(ExternalOrderLifecycleService);
    });

    it('instantiates JournalService with zero arguments without throwing', () => {
      const facade = new JournalService();
      expect(facade).toBeInstanceOf(JournalService);
      expect(facade.core).toBeInstanceOf(JournalCoreService);
      expect(facade.sales).toBeInstanceOf(JournalSalesService);
      expect(facade.procurement).toBeInstanceOf(JournalProcurementService);
      expect(facade.rental).toBeInstanceOf(JournalRentalService);
      expect(facade.inventory).toBeInstanceOf(JournalInventoryService);
    });

    it('instantiates all external-order sub-services independently with zero arguments', () => {
      expect(new ExternalOrderSecurityService()).toBeInstanceOf(ExternalOrderSecurityService);
      expect(new ExternalOrderPartnerService()).toBeInstanceOf(ExternalOrderPartnerService);
      expect(new ExternalOrderCatalogService()).toBeInstanceOf(ExternalOrderCatalogService);
      expect(new ExternalOrderNotificationService()).toBeInstanceOf(ExternalOrderNotificationService);
      expect(new ExternalOrderPaymentService()).toBeInstanceOf(ExternalOrderPaymentService);
      expect(new ExternalOrderLifecycleService()).toBeInstanceOf(ExternalOrderLifecycleService);
    });

    it('instantiates accounting sub-services independently', () => {
      const repo = new JournalRepository();
      const accountService = new AccountService();
      const core = new JournalCoreService(repo, accountService);
      const resolver = new JournalAccountResolver();

      expect(resolver).toBeInstanceOf(JournalAccountResolver);
      expect(new JournalRentalLegacyService(core, resolver)).toBeInstanceOf(JournalRentalLegacyService);
      expect(new JournalRentalService(core)).toBeInstanceOf(JournalRentalService);
      expect(new JournalSalesService(core)).toBeInstanceOf(JournalSalesService);
      expect(new JournalProcurementService(core)).toBeInstanceOf(JournalProcurementService);
      expect(new JournalInventoryService(core)).toBeInstanceOf(JournalInventoryService);
    });
  });

  describe('2. RentalExternalOrderService Method Delegation', () => {
    it('delegates findOrCreateCustomer to partnerService', async () => {
      const facade = new RentalExternalOrderService();
      type PartnerResult = Awaited<ReturnType<ExternalOrderPartnerService['findOrCreateCustomer']>>;
      const mockResult = {
        id: 'partner-1',
        name: 'Test Customer',
        phone: '08123456789',
      } as unknown as PartnerResult;

      const spy = vi
        .spyOn(facade.partnerService, 'findOrCreateCustomer')
        .mockResolvedValue(mockResult);

      const input: RentalIntegrationCustomerInput = {
        name: 'Test Customer',
        phone: '08123456789',
        email: 'test@example.com',
      };
      const result = await facade.findOrCreateCustomer('company-1', input);

      expect(spy).toHaveBeenCalledWith('company-1', input);
      expect(result).toBe(mockResult);
    });

    it('delegates getByToken to securityService', async () => {
      const facade = new RentalExternalOrderService();
      type DtoResult = Awaited<ReturnType<ExternalOrderSecurityService['getByToken']>>;
      const mockDto = { id: 'order-1', publicToken: 'tok-123' } as unknown as DtoResult;
      const spy = vi.spyOn(facade.securityService, 'getByToken').mockResolvedValue(mockDto);

      const result = await facade.getByToken('tok-123');
      expect(spy).toHaveBeenCalledWith('tok-123');
      expect(result).toBe(mockDto);
    });

    it('delegates getById to lifecycleService', async () => {
      const facade = new RentalExternalOrderService();
      type OrderResult = Awaited<ReturnType<ExternalOrderLifecycleService['getById']>>;
      const mockOrder = { id: 'order-1', orderNumber: 'ORD-001' } as unknown as OrderResult;
      const spy = vi.spyOn(facade.lifecycleService, 'getById').mockResolvedValue(mockOrder);

      const result = await facade.getById('company-1', 'order-1');
      expect(spy).toHaveBeenCalledWith('company-1', 'order-1');
      expect(result).toBe(mockOrder);
    });

    it('delegates getByOrderNumber to lifecycleService', async () => {
      const facade = new RentalExternalOrderService();
      type OrderResult = Awaited<ReturnType<ExternalOrderLifecycleService['getByOrderNumber']>>;
      const mockOrder = { id: 'order-1', orderNumber: 'ORD-001' } as unknown as OrderResult;
      const spy = vi.spyOn(facade.lifecycleService, 'getByOrderNumber').mockResolvedValue(mockOrder);

      const result = await facade.getByOrderNumber('company-1', 'ORD-001');
      expect(spy).toHaveBeenCalledWith('company-1', 'ORD-001');
      expect(result).toBe(mockOrder);
    });

    it('delegates createOrder to lifecycleService', async () => {
      const facade = new RentalExternalOrderService();
      type CreateResult = Awaited<ReturnType<ExternalOrderLifecycleService['createOrder']>>;
      const mockResponse = { id: 'ord-new', orderNumber: 'ORD-999', publicToken: 'tok-abc' } as unknown as CreateResult;
      const spy = vi.spyOn(facade.lifecycleService, 'createOrder').mockResolvedValue(mockResponse);

      const input = {
        companyId: 'company-1',
        customer: { name: 'Customer A', phone: '0811111111' },
        items: [{ itemId: 'item-1', quantity: 1, durationDays: 3, dailyRate: 50000 }],
        deliveryFee: 10000,
        startDate: new Date('2026-09-20'),
        endDate: new Date('2026-09-23'),
        deliveryAddress: 'Jl. Testing',
      } as unknown as CreatePublicOrderInput;

      const result = await facade.createOrder(input);
      expect(spy).toHaveBeenCalledWith(input);
      expect(result).toBe(mockResponse);
    });

    it('delegates updateOrder to lifecycleService', async () => {
      const facade = new RentalExternalOrderService();
      type UpdateResult = Awaited<ReturnType<ExternalOrderLifecycleService['updateOrder']>>;
      const mockOrder = { id: 'order-1', orderNumber: 'ORD-001' } as unknown as UpdateResult;
      const spy = vi.spyOn(facade.lifecycleService, 'updateOrder').mockResolvedValue(mockOrder);

      const input = {
        id: 'order-1',
        notes: 'Updated notes',
      } as unknown as UpdatePublicOrderInput;

      const result = await facade.updateOrder(input, 'company-1');
      expect(spy).toHaveBeenCalledWith(input, 'company-1');
      expect(result).toBe(mockOrder);
    });

    it('delegates cancelOrder to lifecycleService', async () => {
      const facade = new RentalExternalOrderService();
      type CancelResult = Awaited<ReturnType<ExternalOrderLifecycleService['cancelOrder']>>;
      const mockOrder = { id: 'order-1', status: 'CANCELLED' } as unknown as CancelResult;
      const spy = vi.spyOn(facade.lifecycleService, 'cancelOrder').mockResolvedValue(mockOrder);

      const input = { id: 'order-1', companyId: 'company-1', reason: 'Customer requested' };
      const result = await facade.cancelOrder(input);
      expect(spy).toHaveBeenCalledWith(input);
      expect(result).toBe(mockOrder);
    });

    it('delegates claimPayment to paymentService', async () => {
      const facade = new RentalExternalOrderService();
      type ClaimResult = Awaited<ReturnType<ExternalOrderPaymentService['claimPayment']>>;
      const mockResult = { id: 'order-1', rentalPaymentStatus: 'MENUNGGU_VERIFIKASI' } as unknown as ClaimResult;
      const spy = vi.spyOn(facade.paymentService, 'claimPayment').mockResolvedValue(mockResult);

      const input: RentalIntegrationClaimPaymentInput = {
        token: '11111111-2222-3333-4444-555555555555',
        paymentMethod: 'transfer',
        reference: 'REF-12345',
      };
      const result = await facade.claimPayment('company-1', input);
      expect(spy).toHaveBeenCalledWith('company-1', input);
      expect(result).toBe(mockResult);
    });

    it('delegates confirmPaymentByOrderNumber to paymentService', async () => {
      const facade = new RentalExternalOrderService();
      type ConfirmResult = Awaited<ReturnType<ExternalOrderPaymentService['confirmPaymentByOrderNumber']>>;
      const mockResult = { id: 'order-1', rentalPaymentStatus: 'LUNAS' } as unknown as ConfirmResult;
      const spy = vi.spyOn(facade.paymentService, 'confirmPaymentByOrderNumber').mockResolvedValue(mockResult);

      const input: RentalIntegrationConfirmPaymentInput = {
        orderNumber: 'ORD-001',
        paymentMethod: 'transfer',
      };
      const result = await facade.confirmPaymentByOrderNumber('company-1', input);
      expect(spy).toHaveBeenCalledWith('company-1', input);
      expect(result).toBe(mockResult);
    });

    it('delegates rejectPaymentByOrderNumber to paymentService', async () => {
      const facade = new RentalExternalOrderService();
      type RejectResult = Awaited<ReturnType<ExternalOrderPaymentService['rejectPaymentByOrderNumber']>>;
      const mockResult = { id: 'order-1', rentalPaymentStatus: 'GAGAL' } as unknown as RejectResult;
      const spy = vi.spyOn(facade.paymentService, 'rejectPaymentByOrderNumber').mockResolvedValue(mockResult);

      const input: RentalIntegrationRejectPaymentInput = {
        orderNumber: 'ORD-001',
        failReason: 'Payment proof not matching',
      };
      const result = await facade.rejectPaymentByOrderNumber('company-1', input);
      expect(spy).toHaveBeenCalledWith('company-1', input);
      expect(result).toBe(mockResult);
    });

    it('delegates deleteOrder to lifecycleService', async () => {
      const facade = new RentalExternalOrderService();
      type DeleteResult = Awaited<ReturnType<ExternalOrderLifecycleService['deleteOrder']>>;
      const mockResult = { count: 1 } as unknown as DeleteResult;
      const spy = vi.spyOn(facade.lifecycleService, 'deleteOrder').mockResolvedValue(mockResult);

      const result = await facade.deleteOrder('order-1', 'company-1');
      expect(spy).toHaveBeenCalledWith('order-1', 'company-1');
      expect(result).toBe(mockResult);
    });
  });

  describe('3. JournalService Method Delegation', () => {
    it('delegates core methods (create, reverse, getById, list, getAccountBalance, resolveAndCreate) to core', async () => {
      const facade = new JournalService();
      const dummyEntry = { id: 'j-1', companyId: 'c-1' } as JournalEntry;
      type GetByIdResult = Awaited<ReturnType<JournalCoreService['getById']>>;
      type ListResult = Awaited<ReturnType<JournalCoreService['list']>>;
      const dummyWithLines = { id: 'j-1', companyId: 'c-1', lines: [] } as unknown as GetByIdResult;

      const reverseSpy = vi.spyOn(facade.core, 'reverse').mockResolvedValue(dummyEntry);
      const createSpy = vi.spyOn(facade.core, 'create').mockResolvedValue(dummyEntry);
      const getByIdSpy = vi.spyOn(facade.core, 'getById').mockResolvedValue(dummyWithLines);
      const listSpy = vi.spyOn(facade.core, 'list').mockResolvedValue([dummyWithLines] as unknown as ListResult);
      const balanceSpy = vi.spyOn(facade.core, 'getAccountBalance').mockResolvedValue(150000);
      const resolveSpy = vi.spyOn(facade.core, 'resolveAndCreate').mockResolvedValue(dummyEntry);

      await facade.reverse('c-1', 'j-1', 'Reason');
      expect(reverseSpy).toHaveBeenCalledWith('c-1', 'j-1', 'Reason', undefined, undefined);

      await facade.create('c-1', { reference: 'REF', lines: [] });
      expect(createSpy).toHaveBeenCalledWith('c-1', { reference: 'REF', lines: [] }, undefined);

      await facade.getById('j-1', 'c-1');
      expect(getByIdSpy).toHaveBeenCalledWith('j-1', 'c-1', undefined);

      await facade.list('c-1');
      expect(listSpy).toHaveBeenCalledWith('c-1', undefined, undefined, undefined);

      const bal = await facade.getAccountBalance('acc-1');
      expect(balanceSpy).toHaveBeenCalledWith('acc-1', undefined);
      expect(bal).toBe(150000);

      await facade.resolveAndCreate('c-1', { reference: 'REF-2', memo: 'Memo', lines: [] });
      expect(resolveSpy).toHaveBeenCalledWith('c-1', { reference: 'REF-2', memo: 'Memo', lines: [] }, undefined);
    });

    it('delegates sales methods to sales sub-service', async () => {
      const facade = new JournalService();
      const dummyEntry = { id: 'j-sales' } as JournalEntry;

      const postInvoiceSpy = vi.spyOn(facade.sales, 'postInvoice').mockResolvedValue(dummyEntry);
      const postInvoiceRevSpy = vi.spyOn(facade.sales, 'postInvoiceReversal').mockResolvedValue(dummyEntry);
      const postCreditSpy = vi.spyOn(facade.sales, 'postCreditNote').mockResolvedValue(dummyEntry);
      const postPayRecSpy = vi.spyOn(facade.sales, 'postPaymentReceived').mockResolvedValue(dummyEntry);
      const postPayRecRevSpy = vi.spyOn(facade.sales, 'postPaymentReceivedReversal').mockResolvedValue(dummyEntry);
      const postShipmentSpy = vi.spyOn(facade.sales, 'postShipment').mockResolvedValue(dummyEntry);
      const postSalesReturnSpy = vi.spyOn(facade.sales, 'postSalesReturn').mockResolvedValue(dummyEntry);
      const postShipmentRevSpy = vi.spyOn(facade.sales, 'postShipmentReversal').mockResolvedValue(dummyEntry);
      const postDepositSpy = vi.spyOn(facade.sales, 'postCustomerDeposit').mockResolvedValue(dummyEntry);
      const postSettleDepSpy = vi.spyOn(facade.sales, 'postSettleCustomerDeposit').mockResolvedValue(dummyEntry);

      await facade.postInvoice('c-1', 'inv-1', 'INV-001', 50000);
      expect(postInvoiceSpy).toHaveBeenCalledWith('c-1', 'inv-1', 'INV-001', 50000, undefined, undefined, undefined, undefined);

      await facade.postInvoiceReversal('c-1', 'inv-1', 'INV-001', 50000);
      expect(postInvoiceRevSpy).toHaveBeenCalledWith('c-1', 'inv-1', 'INV-001', 50000, undefined, undefined, undefined);

      await facade.postCreditNote('c-1', 'cn-1', 'INV-001', 20000);
      expect(postCreditSpy).toHaveBeenCalledWith('c-1', 'cn-1', 'INV-001', 20000, undefined, undefined, undefined, undefined);

      await facade.postPaymentReceived('c-1', 'p-1', 'INV-001', 50000, 'bca');
      expect(postPayRecSpy).toHaveBeenCalledWith('c-1', 'p-1', 'INV-001', 50000, 'bca', undefined, undefined, undefined);

      await facade.postPaymentReceivedReversal('c-1', 'p-1', 'INV-001', 50000, 'bca');
      expect(postPayRecRevSpy).toHaveBeenCalledWith('c-1', 'p-1', 'INV-001', 50000, 'bca', undefined, undefined);

      await facade.postShipment('c-1', 'SHIP-001', 40000);
      expect(postShipmentSpy).toHaveBeenCalledWith('c-1', 'SHIP-001', 40000, undefined);

      await facade.postSalesReturn('c-1', 'SR-001', 15000);
      expect(postSalesReturnSpy).toHaveBeenCalledWith('c-1', 'SR-001', 15000, undefined);

      await facade.postShipmentReversal('c-1', 'SHIP-001', 40000);
      expect(postShipmentRevSpy).toHaveBeenCalledWith('c-1', 'SHIP-001', 40000, undefined);

      await facade.postCustomerDeposit('c-1', 'pay-1', 'ORD-001', 30000, 'bca');
      expect(postDepositSpy).toHaveBeenCalledWith('c-1', 'pay-1', 'ORD-001', 30000, 'bca', undefined, undefined);

      await facade.postSettleCustomerDeposit('c-1', 'pay-1', 'INV-001', 30000);
      expect(postSettleDepSpy).toHaveBeenCalledWith('c-1', 'pay-1', 'INV-001', 30000, undefined);
    });

    it('delegates procurement methods to procurement sub-service', async () => {
      const facade = new JournalService();
      const dummyEntry = { id: 'j-proc' } as JournalEntry;

      const postBillSpy = vi.spyOn(facade.procurement, 'postBill').mockResolvedValue(dummyEntry);
      const postBillRevSpy = vi.spyOn(facade.procurement, 'postBillReversal').mockResolvedValue(dummyEntry);
      const postDebitSpy = vi.spyOn(facade.procurement, 'postDebitNote').mockResolvedValue(dummyEntry);
      const postGrnSpy = vi.spyOn(facade.procurement, 'postGoodsReceipt').mockResolvedValue(dummyEntry);
      const postGrnRevSpy = vi.spyOn(facade.procurement, 'postGoodsReceiptReversal').mockResolvedValue(dummyEntry);
      const postPayMadeSpy = vi.spyOn(facade.procurement, 'postPaymentMade').mockResolvedValue(dummyEntry);
      const postPayMadeRevSpy = vi.spyOn(facade.procurement, 'postPaymentMadeReversal').mockResolvedValue(dummyEntry);
      const postPurchRetSpy = vi.spyOn(facade.procurement, 'postPurchaseReturn').mockResolvedValue(dummyEntry);
      const postUpfrontSpy = vi.spyOn(facade.procurement, 'postUpfrontPayment').mockResolvedValue(dummyEntry);
      const postSettlePrepSpy = vi.spyOn(facade.procurement, 'postSettlePrepaid').mockResolvedValue(dummyEntry);

      await facade.postBill('c-1', 'bill-1', 'BILL-001', 75000);
      expect(postBillSpy).toHaveBeenCalledWith('c-1', 'bill-1', 'BILL-001', 75000, undefined, undefined, undefined, undefined);

      await facade.postBillReversal('c-1', 'bill-1', 'BILL-001', 75000);
      expect(postBillRevSpy).toHaveBeenCalledWith('c-1', 'bill-1', 'BILL-001', 75000, undefined, undefined, undefined);

      await facade.postDebitNote('c-1', 'dn-1', 'BILL-001', 15000);
      expect(postDebitSpy).toHaveBeenCalledWith('c-1', 'dn-1', 'BILL-001', 15000, undefined, undefined, undefined, undefined);

      await facade.postGoodsReceipt('c-1', 'GRN-001', 60000);
      expect(postGrnSpy).toHaveBeenCalledWith('c-1', 'GRN-001', 60000, undefined, undefined);

      await facade.postGoodsReceiptReversal('c-1', 'GRN-001', 60000);
      expect(postGrnRevSpy).toHaveBeenCalledWith('c-1', 'GRN-001', 60000, undefined);

      await facade.postPaymentMade('c-1', 'p-1', 'BILL-001', 75000, 'bca');
      expect(postPayMadeSpy).toHaveBeenCalledWith('c-1', 'p-1', 'BILL-001', 75000, 'bca', undefined, undefined, undefined);

      await facade.postPaymentMadeReversal('c-1', 'p-1', 'BILL-001', 75000, 'bca');
      expect(postPayMadeRevSpy).toHaveBeenCalledWith('c-1', 'p-1', 'BILL-001', 75000, 'bca', undefined, undefined);

      await facade.postPurchaseReturn('c-1', 'PR-001', 20000);
      expect(postPurchRetSpy).toHaveBeenCalledWith('c-1', 'PR-001', 20000, undefined);

      await facade.postUpfrontPayment('c-1', 'pay-1', 'PO-001', 25000, 'cash');
      expect(postUpfrontSpy).toHaveBeenCalledWith('c-1', 'pay-1', 'PO-001', 25000, 'cash', undefined, undefined);

      await facade.postSettlePrepaid('c-1', 'pay-1', 'BILL-001', 25000);
      expect(postSettlePrepSpy).toHaveBeenCalledWith('c-1', 'pay-1', 'BILL-001', 25000, undefined);
    });

    it('delegates inventory methods (postAdjustment) to inventory', async () => {
      const facade = new JournalService();
      const dummyEntry = { id: 'j-inv' } as JournalEntry;

      const postAdjSpy = vi.spyOn(facade.inventory, 'postAdjustment').mockResolvedValue(dummyEntry);
      await facade.postAdjustment('c-1', 'ADJ-001', 12000, true);
      expect(postAdjSpy).toHaveBeenCalledWith('c-1', 'ADJ-001', 12000, true, undefined);
    });

    it('delegates rental methods (postRentalDownPayment, postRentalReleaseSettlement, etc.) to rental', async () => {
      const facade = new JournalService();
      const dummyEntry = { id: 'j-rental' } as JournalEntry;

      const dpSpy = vi.spyOn(facade.rental, 'postRentalDownPayment').mockResolvedValue(dummyEntry);
      const relSpy = vi.spyOn(facade.rental, 'postRentalReleaseSettlement').mockResolvedValue(dummyEntry);
      const extSpy = vi.spyOn(facade.rental, 'postRentalExtension').mockResolvedValue(dummyEntry);
      const dmgSpy = vi.spyOn(facade.rental, 'postRentalDamageFee').mockResolvedValue(dummyEntry);
      const lateSpy = vi.spyOn(facade.rental, 'postRentalLateFee').mockResolvedValue(dummyEntry);
      const refSpy = vi.spyOn(facade.rental, 'postRentalCancellationRefund').mockResolvedValue(dummyEntry);
      const depSpy = vi.spyOn(facade.rental, 'postRentalDeposit').mockResolvedValue(dummyEntry);
      const retSpy = vi.spyOn(facade.rental, 'postRentalReturn').mockResolvedValue(dummyEntry);

      const dpParams = { companyId: 'c-1', orderId: 'ord-1', orderNumber: 'RNT-001', downPaymentAmount: 30000 };
      await facade.postRentalDownPayment(dpParams);
      expect(dpSpy).toHaveBeenCalledWith(dpParams);

      const relParams = {
        companyId: 'c-1',
        orderId: 'ord-1',
        orderNumber: 'RNT-001',
        settlementAmount: 70000,
        downPaymentAmount: 30000,
        rentalRevenueAmount: 100000,
      };
      await facade.postRentalReleaseSettlement(relParams);
      expect(relSpy).toHaveBeenCalledWith(relParams);

      const extParams = { companyId: 'c-1', orderId: 'ord-1', orderNumber: 'RNT-001', extensionAmount: 50000 };
      await facade.postRentalExtension(extParams);
      expect(extSpy).toHaveBeenCalledWith(extParams);

      const dmgParams = { companyId: 'c-1', orderId: 'ord-1', orderNumber: 'RNT-001', damageFeeAmount: 15000 };
      await facade.postRentalDamageFee(dmgParams);
      expect(dmgSpy).toHaveBeenCalledWith(dmgParams);

      const lateParams = { companyId: 'c-1', orderId: 'ord-1', orderNumber: 'RNT-001', lateFeeAmount: 10000 };
      await facade.postRentalLateFee(lateParams);
      expect(lateSpy).toHaveBeenCalledWith(lateParams);

      const refParams = { companyId: 'c-1', orderId: 'ord-1', orderNumber: 'RNT-001', refundAmount: 30000 };
      await facade.postRentalCancellationRefund(refParams);
      expect(refSpy).toHaveBeenCalledWith(refParams);

      await facade.postRentalDeposit('c-1', 'dep-1', 'RNT-001', 50000, 'bca');
      expect(depSpy).toHaveBeenCalledWith('c-1', 'dep-1', 'RNT-001', 50000, 'bca', undefined, undefined);

      await facade.postRentalReturn('c-1', 'ret-1', 'RNT-001', 50000, 40000, 10000, 'bca');
      expect(retSpy).toHaveBeenCalledWith('c-1', 'ret-1', 'RNT-001', 50000, 40000, 10000, 'bca', undefined, undefined);
    });

    it('delegates legacy rental calls from JournalRentalService to JournalRentalLegacyService', async () => {
      const repo = new JournalRepository();
      const accountService = new AccountService();
      const core = new JournalCoreService(repo, accountService);
      const resolver = new JournalAccountResolver();
      const legacy = new JournalRentalLegacyService(core, resolver);
      const rentalService = new JournalRentalService(core, resolver, legacy);

      const dummyEntry = { id: 'j-legacy' } as JournalEntry;
      const depSpy = vi.spyOn(legacy, 'postRentalDeposit').mockResolvedValue(dummyEntry);
      const retSpy = vi.spyOn(legacy, 'postRentalReturn').mockResolvedValue(dummyEntry);

      await rentalService.postRentalDeposit('c-1', 'dep-1', 'ORD-01', 1000, 'cash');
      expect(depSpy).toHaveBeenCalledWith('c-1', 'dep-1', 'ORD-01', 1000, 'cash', undefined, undefined);

      await rentalService.postRentalReturn('c-1', 'ret-1', 'ORD-01', 1000, 800, 200, 'cash');
      expect(retSpy).toHaveBeenCalledWith('c-1', 'ret-1', 'ORD-01', 1000, 800, 200, 'cash', undefined, undefined);
    });
  });

  describe('4. Error Handling & Unmasked Propagation', () => {
    it('propagates DomainError from RentalExternalOrderService sub-services verbatim', async () => {
      const facade = new RentalExternalOrderService();
      const expectedError = new DomainError('Order token expired', 410, DomainErrorCodes.ORDER_INVALID_STATE);

      vi.spyOn(facade.securityService, 'getByToken').mockRejectedValue(expectedError);

      await expect(facade.getByToken('expired-token')).rejects.toThrow(expectedError);
      await expect(facade.getByToken('expired-token')).rejects.toMatchObject({
        message: 'Order token expired',
        statusCode: 410,
        code: DomainErrorCodes.ORDER_INVALID_STATE,
      });
    });

    it('propagates raw Error and database exceptions from RentalExternalOrderService without swallowing', async () => {
      const facade = new RentalExternalOrderService();
      const dbError = new Error('Database connection failed');

      vi.spyOn(facade.lifecycleService, 'deleteOrder').mockRejectedValue(dbError);

      await expect(facade.deleteOrder('order-1', 'company-1')).rejects.toThrow('Database connection failed');
    });

    it('propagates DomainError from JournalService sub-services verbatim', async () => {
      const facade = new JournalService();
      const expectedError = new DomainError('Down payment amount must be greater than 0', 400, DomainErrorCodes.INVALID_INPUT);

      vi.spyOn(facade.rental, 'postRentalDownPayment').mockRejectedValue(expectedError);

      const params = { companyId: 'c-1', orderId: 'ord-1', orderNumber: 'RNT-001', downPaymentAmount: 0 };
      await expect(facade.postRentalDownPayment(params)).rejects.toThrow(expectedError);
      await expect(facade.postRentalDownPayment(params)).rejects.toMatchObject({
        message: 'Down payment amount must be greater than 0',
        statusCode: 400,
        code: DomainErrorCodes.INVALID_INPUT,
      });
    });

    it('propagates legacy rental domain errors from JournalService without swallowing', async () => {
      const facade = new JournalService();
      const expectedError = new DomainError('Contra account not found', 404, DomainErrorCodes.NOT_FOUND);

      vi.spyOn(facade.rental, 'postRentalDeposit').mockRejectedValue(expectedError);

      await expect(facade.postRentalDeposit('c-1', 'dep-1', 'RNT-001', 10000, 'unknown_method')).rejects.toThrow(expectedError);
    });

    it('propagates unexpected exceptions through JournalService without catching or transforming', async () => {
      const facade = new JournalService();
      const unexpected = new TypeError('Cannot read properties of null');

      vi.spyOn(facade.sales, 'postInvoice').mockRejectedValue(unexpected);

      await expect(facade.postInvoice('c-1', 'inv-1', 'INV-001', 50000)).rejects.toThrow(TypeError);
      await expect(facade.postInvoice('c-1', 'inv-1', 'INV-001', 50000)).rejects.toThrow('Cannot read properties of null');
    });
  });
});
