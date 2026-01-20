import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@sync-erp/database';
import { ProductService } from '@modules/product/product.service';
import { PartnerService } from '@modules/partner/partner.service';
import { PurchaseOrderService } from '@modules/procurement/purchase-order.service';
import { AccountService } from '@modules/accounting/services/account.service';

// Initialize Services
const productService = new ProductService();
const partnerService = new PartnerService();
const purchaseOrderService = new PurchaseOrderService();
const accountService = new AccountService();

// Unique IDs for test isolation
const COMPANY_A_ID = `test-isolation-company-a-${Date.now()}`;
const COMPANY_B_ID = `test-isolation-company-b-${Date.now()}`;

describe('Multi-Company Data Isolation', () => {
  beforeAll(async () => {
    // Create two test companies
    await prisma.company.create({
      data: { id: COMPANY_A_ID, name: 'Isolation Test Company A' },
    });
    await prisma.company.create({
      data: { id: COMPANY_B_ID, name: 'Isolation Test Company B' },
    });
  });

  afterAll(async () => {
    // Cleanup - order matters due to foreign keys
    const cleanupTx = [
      prisma.orderItem.deleteMany({
        where: {
          order: { companyId: { in: [COMPANY_A_ID, COMPANY_B_ID] } },
        },
      }),
      prisma.order.deleteMany({
        where: { companyId: { in: [COMPANY_A_ID, COMPANY_B_ID] } },
      }),
      prisma.account.deleteMany({
        where: { companyId: { in: [COMPANY_A_ID, COMPANY_B_ID] } },
      }),
      prisma.partner.deleteMany({
        where: { companyId: { in: [COMPANY_A_ID, COMPANY_B_ID] } },
      }),
      prisma.product.deleteMany({
        where: { companyId: { in: [COMPANY_A_ID, COMPANY_B_ID] } },
      }),
      prisma.company.deleteMany({
        where: { id: { in: [COMPANY_A_ID, COMPANY_B_ID] } },
      }),
    ];
    await prisma.$transaction(cleanupTx);
  });

  describe('Product Isolation', () => {
    let productAId: string;

    it('should create product in Company A', async () => {
      const product = await productService.create(COMPANY_A_ID, {
        name: 'Product A',
        sku: `SKU-A-${Date.now()}`,
        price: 100,
      });
      expect(product).toBeDefined();
      expect(product.companyId).toBe(COMPANY_A_ID);
      productAId = product.id;
    });

    it('Company A should see Product A', async () => {
      const products = await productService.list(COMPANY_A_ID);
      expect(products.some((p) => p.id === productAId)).toBe(true);
    });

    it('Company B should NOT see Product A', async () => {
      const products = await productService.list(COMPANY_B_ID);
      expect(products.some((p) => p.id === productAId)).toBe(false);
    });
  });

  describe('Partner Isolation', () => {
    let partnerAId: string;

    it('should create partner in Company A', async () => {
      const partner = await partnerService.create(COMPANY_A_ID, {
        name: 'Partner A',
        email: `partner-a-${Date.now()}@test.com`,
        phone: '1234567890',
        type: 'CUSTOMER',
      });
      expect(partner).toBeDefined();
      expect(partner.companyId).toBe(COMPANY_A_ID);
      partnerAId = partner.id;
    });

    it('Company A should see Partner A', async () => {
      const partners = await partnerService.list(COMPANY_A_ID);
      expect(partners.some((p) => p.id === partnerAId)).toBe(true);
    });

    it('Company B should NOT see Partner A', async () => {
      const partners = await partnerService.list(COMPANY_B_ID);
      expect(partners.some((p) => p.id === partnerAId)).toBe(false);
    });
  });

  describe('Order Isolation (PO)', () => {
    let poAId: string;
    let supplierAId: string;
    let productForPO: string;

    beforeAll(async () => {
      // Create supplier for Company A
      const supplier = await partnerService.create(COMPANY_A_ID, {
        name: 'Supplier A for PO',
        email: `supplier-po-${Date.now()}@test.com`,
        phone: '111',
        type: 'SUPPLIER',
      });
      supplierAId = supplier.id;

      // Create product for Company A
      const product = await productService.create(COMPANY_A_ID, {
        name: 'Product for PO',
        sku: `SKU-PO-${Date.now()}`,
        price: 100,
      });
      productForPO = product.id;
    });

    it('should create PO in Company A', async () => {
      const po = await purchaseOrderService.create(COMPANY_A_ID, {
        partnerId: supplierAId,
        type: 'PURCHASE',
        paymentTerms: 'NET30',
        items: [{ productId: productForPO, quantity: 1, price: 100 }],
      });
      expect(po).toBeDefined();
      expect(po.companyId).toBe(COMPANY_A_ID);
      poAId = po.id;
    });

    it('Company A should see PO A', async () => {
      const orders = await purchaseOrderService.list(COMPANY_A_ID);
      expect(orders.some((o) => o.id === poAId)).toBe(true);
    });

    it('Company B should NOT see PO A', async () => {
      const orders = await purchaseOrderService.list(COMPANY_B_ID);
      expect(orders.some((o) => o.id === poAId)).toBe(false);
    });
  });

  describe('Finance Isolation (Accounts)', () => {
    let accountAId: string;

    it('should create Account in Company A', async () => {
      const randomCode = Math.floor(
        1000 + Math.random() * 9000
      ).toString();
      const account = await accountService.create(COMPANY_A_ID, {
        code: randomCode,
        name: 'Cash A',
        type: 'ASSET',
      });
      expect(account).toBeDefined();
      expect(account.companyId).toBe(COMPANY_A_ID);
      accountAId = account.id;
    });

    it('Company A should see Account A', async () => {
      const accounts = await accountService.list(COMPANY_A_ID);
      expect(accounts.some((a) => a.id === accountAId)).toBe(true);
    });

    it('Company B should NOT see Account A', async () => {
      const accounts = await accountService.list(COMPANY_B_ID);
      expect(accounts.some((a) => a.id === accountAId)).toBe(false);
    });
  });
});
