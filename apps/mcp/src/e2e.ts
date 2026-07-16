import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
<<<<<<< HEAD
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
=======
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
>>>>>>> origin/dev
import type { TextContent } from './types.js';

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getAuthHeaders() {
  const token = getEnv(
    'SYNC_ERP_MCP_BEARER_TOKEN',
    process.env.MCP_BEARER_TOKEN
  );

  return {
    Authorization: `Bearer ${token}`,
  };
}

function createAuthFetch() {
  const headers = getAuthHeaders();

  return async (url: string | URL | Request, init?: RequestInit) => {
    const mergedHeaders = new Headers(init?.headers);
    for (const [key, value] of Object.entries(headers)) {
      mergedHeaders.set(key, value);
    }

    return fetch(url, {
      ...init,
      headers: mergedHeaders,
    });
  };
}

function getTextPayload(result: Awaited<ReturnType<Client['callTool']>>) {
  const content = result.content as TextContent[];
  const textBlock = content.find((item) => item.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('MCP tool returned no text payload.');
  }

  return textBlock.text;
}

async function callJsonTool(
  client: Client,
  name: string,
  args: Record<string, unknown>
) {
  const result = await client.callTool({ name, arguments: args });
  const payload = getTextPayload(result);

  try {
    return JSON.parse(payload) as Record<string, unknown> | unknown[];
  } catch (error) {
    throw new Error(
      `Tool ${name} returned non-JSON payload: ${payload}\n${error}`
    );
  }
}

function ensureArray<T>(value: unknown, label: string): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} is not an array.`);
  }

  return value as T[];
}

function ensureRecord(
  value: unknown,
  label: string
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} is not an object.`);
  }

  return value as Record<string, unknown>;
}

function pickId(record: Record<string, unknown>, label: string): string {
  const id = record.id;
  if (typeof id !== 'string' || !id) {
    throw new Error(`${label} is missing an id.`);
  }
  return id;
}

function pickNumber(
  record: Record<string, unknown>,
  keys: string[],
  label: string
): number {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  throw new Error(`${label} is missing numeric field: ${keys.join(', ')}`);
}

async function main() {
  const serverUrl = getEnv(
    'SYNC_ERP_MCP_URL',
<<<<<<< HEAD
    'http://localhost:3005/mcp'
  );
  const authHeaders = getAuthHeaders();
  const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
    requestInit: { headers: authHeaders },
    fetch: createAuthFetch(),
=======
    'http://localhost:3001/mcp/sse'
  );
  const authHeaders = getAuthHeaders();
  const transport = new SSEClientTransport(new URL(serverUrl), {
    requestInit: { headers: authHeaders },
    eventSourceInit: {
      fetch: createAuthFetch(),
    },
>>>>>>> origin/dev
  });
  const client = new Client({
    name: 'sync-erp-mcp-e2e',
    version: '1.0.0',
  });

  const runId = Date.now();
  const suffix = String(runId).slice(-8);
  const companyName = `MCP E2E ${suffix}`;
  const sku = `MCP-E2E-${suffix}`;
  const reference = `MCP-E2E-${runId}`;

  try {
    await client.connect(transport);

    const tools = await client.listTools();
    console.log(`Connected. Tools available: ${tools.tools.length}`);

    const createdCompanyPayload = await callJsonTool(client, 'company_create', {
      name: companyName,
    });
    const createdCompany = ensureRecord(
      createdCompanyPayload,
      'company_create'
    );
    const companyId = pickId(createdCompany, 'Created company');
    console.log(`Company created: ${companyId}`);

    await callJsonTool(client, 'company_select_shape', {
      companyId,
      shape: 'RETAIL',
    });
    console.log(`Company shape selected: ${companyId}`);

    let accountsPayload = await callJsonTool(client, 'finance_accounts_list', {
      companyId,
    });
    let accounts = ensureArray<Record<string, unknown>>(
      accountsPayload,
      'finance_accounts_list'
    );

    if (accounts.length === 0) {
      await callJsonTool(client, 'finance_accounts_seed', { companyId });
      accountsPayload = await callJsonTool(client, 'finance_accounts_list', {
        companyId,
      });
      accounts = ensureArray<Record<string, unknown>>(
        accountsPayload,
        'finance_accounts_list after seed'
      );
    }

    if (accounts.length === 0) {
      throw new Error('Chart of accounts is empty after setup.');
    }

    console.log(`Accounts ready: ${accounts.length}`);

    const supplierPayload = await callJsonTool(client, 'partner_create', {
      companyId,
      name: `Supplier ${suffix}`,
      type: 'SUPPLIER',
      email: `supplier.${suffix}@example.com`,
      phone: '081234567890',
      address: 'Jakarta',
    });
    const supplier = ensureRecord(supplierPayload, 'partner_create supplier');
    const supplierId = pickId(supplier, 'Supplier');

    const customerPayload = await callJsonTool(client, 'partner_create', {
      companyId,
      name: `Customer ${suffix}`,
      type: 'CUSTOMER',
      email: `customer.${suffix}@example.com`,
      phone: '081234567891',
      address: 'Bandung',
    });
    const customer = ensureRecord(customerPayload, 'partner_create customer');
    const customerId = pickId(customer, 'Customer');

    const productPayload = await callJsonTool(client, 'product_create', {
      companyId,
      name: `Produk E2E ${suffix}`,
      sku,
      price: 250000,
      cost: 150000,
      unit: 'pcs',
      description: 'Produk untuk uji MCP end-to-end',
    });
    const product = ensureRecord(productPayload, 'product_create');
    const productId = pickId(product, 'Product');
    console.log(`Master data created: supplier, customer, product`);

    const purchaseOrderPayload = await callJsonTool(
      client,
      'purchase_order_create',
      {
        companyId,
        partnerId: supplierId,
        reference: `${reference}-PO`,
        notes: 'E2E procurement via MCP',
        items: JSON.stringify([
          {
            productId,
            quantity: 5,
            unitPrice: 150000,
          },
        ]),
      }
    );
    const purchaseOrder = ensureRecord(
      purchaseOrderPayload,
      'purchase_order_create'
    );
    const purchaseOrderId = pickId(purchaseOrder, 'Purchase order');

    await callJsonTool(client, 'purchase_order_confirm', {
      companyId,
      id: purchaseOrderId,
    });

    const grnPayload = await callJsonTool(client, 'inventory_grn_create', {
      companyId,
      input: JSON.stringify({
        orderId: purchaseOrderId,
        items: [{ productId, quantity: 5 }],
      }),
    });
    const grn = ensureRecord(grnPayload, 'inventory_grn_create');
    const grnId = pickId(grn, 'GRN');

    await callJsonTool(client, 'inventory_grn_post', {
      companyId,
      id: grnId,
    });

    const billPayload = await callJsonTool(client, 'bill_create_from_po', {
      companyId,
      orderId: purchaseOrderId,
      reference: `${reference}-BILL`,
    });
    const bill = ensureRecord(billPayload, 'bill_create_from_po');
    const billId = pickId(bill, 'Bill');

    await callJsonTool(client, 'bill_post', {
      companyId,
      id: billId,
    });

    const billDetailPayload = await callJsonTool(client, 'bill_get', {
      companyId,
      id: billId,
    });
    const billDetail = ensureRecord(billDetailPayload, 'bill_get');
    const billAmount = pickNumber(
      billDetail,
      ['balance', 'amount', 'grandTotal', 'totalAmount'],
      'Bill amount'
    );

    const billPaymentPayload = await callJsonTool(client, 'payment_create', {
      companyId,
      input: JSON.stringify({
        invoiceId: billId,
        amount: billAmount,
        method: 'CASH',
        reference: `${reference}-BILL-PAY`,
        correlationId: randomUUID(),
      }),
    });
    const billPayment = ensureRecord(billPaymentPayload, 'payment_create bill');
    const billPaymentId = pickId(billPayment, 'Bill payment');
    console.log(`Procurement completed: ${purchaseOrderId}`);

    const salesOrderPayload = await callJsonTool(client, 'sales_order_create', {
      companyId,
      partnerId: customerId,
      reference: `${reference}-SO`,
      notes: 'E2E sales via MCP',
      items: JSON.stringify([
        {
          productId,
          quantity: 2,
          price: 250000,
        },
      ]),
    });
    const salesOrder = ensureRecord(salesOrderPayload, 'sales_order_create');
    const salesOrderId = pickId(salesOrder, 'Sales order');

    await callJsonTool(client, 'sales_order_confirm', {
      companyId,
      id: salesOrderId,
    });
    await callJsonTool(client, 'sales_order_ship', {
      companyId,
      id: salesOrderId,
      reference: `${reference}-SHIP`,
    });

    const invoicePayload = await callJsonTool(
      client,
      'invoice_create_from_so',
      {
        companyId,
        orderId: salesOrderId,
        reference: `${reference}-INV`,
      }
    );
    const invoice = ensureRecord(invoicePayload, 'invoice_create_from_so');
    const invoiceId = pickId(invoice, 'Invoice');

    await callJsonTool(client, 'invoice_post', {
      companyId,
      id: invoiceId,
    });

    const invoiceDetailPayload = await callJsonTool(client, 'invoice_get', {
      companyId,
      id: invoiceId,
    });
    const invoiceDetail = ensureRecord(invoiceDetailPayload, 'invoice_get');
    const invoiceAmount = pickNumber(
      invoiceDetail,
      ['balance', 'amount', 'grandTotal', 'totalAmount'],
      'Invoice amount'
    );

    const customerPaymentPayload = await callJsonTool(
      client,
      'payment_create',
      {
        companyId,
        input: JSON.stringify({
          invoiceId,
          amount: invoiceAmount,
          method: 'CASH',
          reference: `${reference}-INV-PAY`,
          correlationId: randomUUID(),
        }),
      }
    );
    const customerPayment = ensureRecord(
      customerPaymentPayload,
      'payment_create invoice'
    );
    const customerPaymentId = pickId(customerPayment, 'Customer payment');

    const stockLevelsPayload = await callJsonTool(
      client,
      'inventory_stock_levels',
      { companyId }
    );
    const stockLevels = ensureArray<Record<string, unknown>>(
      stockLevelsPayload,
      'inventory_stock_levels'
    );

    const journalsPayload = await callJsonTool(
      client,
      'finance_journals_list',
      { companyId }
    );
    const journals = ensureArray<Record<string, unknown>>(
      journalsPayload,
      'finance_journals_list'
    );

    console.log(
      JSON.stringify(
        {
          success: true,
          companyId,
          purchaseOrderId,
          grnId,
          billId,
          billPaymentId,
          salesOrderId,
          invoiceId,
          customerPaymentId,
          stockLevelCount: stockLevels.length,
          journalCount: journals.length,
        },
        null,
        2
      )
    );
  } finally {
    await transport.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
