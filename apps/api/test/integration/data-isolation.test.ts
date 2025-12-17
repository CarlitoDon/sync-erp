import { describe, it, expect, beforeAll } from 'vitest';

const API_URL = 'http://localhost:3001/api';

// Helper to standard fetch with headers
const request = async (
  endpoint: string,
  method: string,
  headers: Record<string, string>,
  body?: any
) => {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    // ignore json parse error for empty body
  }

  return {
    status: res.status,
    body: data as any,
  };
};

// Skip: This test requires a running API server on localhost:3001
describe.skip('Multi-Company Data Isolation', () => {
  let companyAId: string;
  let companyBId: string;
  let userAId: string;
  let userBId: string;

  // Headers generators
  const headersA = () => ({
    'x-user-id': userAId,
    'x-company-id': companyAId,
  });
  const headersB = () => ({
    'x-user-id': userBId,
    'x-company-id': companyBId,
  });

  beforeAll(async () => {
    const timestamp = Date.now();

    // 1. Create Company A (No User context initially)
    // We send x-company-id: temp because middleware requires it
    const resCompA = await request(
      '/companies',
      'POST',
      { 'x-company-id': 'temp' },
      {
        name: `Isolation Test Company A ${timestamp}`,
      }
    );
    expect(resCompA.status).toBe(201);
    companyAId = resCompA.body.data.id;
    // console.log('Created Company A:', companyAId);

    // 2. Create User A in Company A
    const resUserA = await request(
      '/users',
      'POST',
      { 'x-company-id': companyAId },
      {
        email: `usera-${timestamp}@test.com`,
        name: 'User A',
      }
    );
    expect(resUserA.status).toBe(201);
    userAId = resUserA.body.data.id;
    // console.log('Created User A:', userAId);

    // 3. Create Company B
    const resCompB = await request(
      '/companies',
      'POST',
      { 'x-company-id': 'temp' },
      {
        name: `Isolation Test Company B ${timestamp}`,
      }
    );
    expect(resCompB.status).toBe(201);
    companyBId = resCompB.body.data.id;
    // console.log('Created Company B:', companyBId);

    // 4. Create User B in Company B
    const resUserB = await request(
      '/users',
      'POST',
      { 'x-company-id': companyBId },
      {
        email: `userb-${timestamp}@test.com`,
        name: 'User B',
      }
    );
    expect(resUserB.status).toBe(201);
    userBId = resUserB.body.data.id;
    // console.log('Created User B:', userBId);
  });

  describe('Product Isolation', () => {
    let productAId: string;

    it('should create product in Company A', async () => {
      const res = await request('/products', 'POST', headersA(), {
        name: 'Product A',
        sku: `SKU-A-${Date.now()}`,
        price: 100,
        stock: 10,
      });
      expect(res.status).toBe(201);
      productAId = res.body.data.id;
    });

    it('Company A should see Product A', async () => {
      const res = await request('/products', 'GET', headersA());
      expect(res.status).toBe(200);
      const products = res.body.data;
      expect(products.some((p: any) => p.id === productAId)).toBe(
        true
      );
    });

    it('Company B should NOT see Product A', async () => {
      const res = await request('/products', 'GET', headersB());
      expect(res.status).toBe(200);
      const products = res.body.data;
      expect(products.some((p: any) => p.id === productAId)).toBe(
        false
      );
    });
  });

  describe('Partner Isolation', () => {
    let partnerAId: string;

    it('should create partner in Company A', async () => {
      const res = await request('/partners', 'POST', headersA(), {
        name: 'Partner A',
        email: `partner-a-${Date.now()}@test.com`,
        phone: '1234567890',
        type: 'CUSTOMER',
      });
      expect(res.status).toBe(201);
      partnerAId = res.body.data.id;
    });

    it('Company A should see Partner A', async () => {
      const res = await request('/partners', 'GET', headersA());
      expect(res.status).toBe(200);
      const partners = res.body.data;
      expect(partners.some((p: any) => p.id === partnerAId)).toBe(
        true
      );
    });

    it('Company B should NOT see Partner A', async () => {
      const res = await request('/partners', 'GET', headersB());
      expect(res.status).toBe(200);
      const partners = res.body.data;
      expect(partners.some((p: any) => p.id === partnerAId)).toBe(
        false
      );
    });
  });

  describe('Order Isolation (PO)', () => {
    let poAId: string;

    it('should create PO in Company A', async () => {
      // Create Supplier for A if not exists
      // Re-use partnerAId if type was SUPPLIER? No, it was CUSTOMER.
      const suppRes = await request('/partners', 'POST', headersA(), {
        name: 'Supplier A',
        email: `supplier-a-${Date.now()}@test.com`,
        phone: '111',
        type: 'SUPPLIER',
      });
      const supplierId = suppRes.body.data.id;

      // Get Product A ID from previous test?
      // We can't easily access variables across describe blocks if not shared.
      // But we can fetch products to get one.
      const prodRes = await request('/products', 'GET', headersA());
      const productAId = prodRes.body.data[0].id;

      const res = await request(
        '/purchase-orders',
        'POST',
        headersA(),
        {
          partnerId: supplierId,
          date: new Date().toISOString(),
          items: [{ productId: productAId, quantity: 1, price: 100 }],
        }
      );

      if (res.status !== 201) {
        // Error logging
      }
      expect(res.status).toBe(201);
      poAId = res.body.data.id;
    });

    it('Company A should see PO A', async () => {
      const res = await request(
        '/purchase-orders',
        'GET',
        headersA()
      );
      expect(res.status).toBe(200);
      const orders = res.body.data;
      expect(orders.some((o: any) => o.id === poAId)).toBe(true);
    });

    it('Company B should NOT see PO A', async () => {
      const res = await request(
        '/purchase-orders',
        'GET',
        headersB()
      );
      expect(res.status).toBe(200);
      const orders = res.body.data;
      expect(orders.some((o: any) => o.id === poAId)).toBe(false);
    });
  });

  describe('Finance Isolation (Accounts)', () => {
    let accountAId: string;

    it('should create Account in Company A', async () => {
      // Code must be max 10 chars.
      // Using random 4 digits.
      const randomCode = Math.floor(
        1000 + Math.random() * 9000
      ).toString();
      const res = await request(
        '/finance/accounts',
        'POST',
        headersA(),
        {
          code: randomCode,
          name: 'Cash A',
          type: 'ASSET',
        }
      );

      if (res.status !== 201) {
        // Error logging
      }
      expect(res.status).toBe(201);
      accountAId = res.body.data.id;
    });

    it('Company A should see Account A', async () => {
      const res = await request(
        '/finance/accounts',
        'GET',
        headersA()
      );
      expect(res.status).toBe(200);
      const accounts = res.body.data;
      expect(accounts.some((a: any) => a.id === accountAId)).toBe(
        true
      );
    });

    it('Company B should NOT see Account A', async () => {
      const res = await request(
        '/finance/accounts',
        'GET',
        headersB()
      );
      expect(res.status).toBe(200);
      const accounts = res.body.data;
      expect(accounts.some((a: any) => a.id === accountAId)).toBe(
        false
      );
    });
  });
});
