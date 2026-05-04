import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

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
  const textBlock = result.content.find((item) => item.type === 'text');
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

function pickOptionalNumber(
  record: Record<string, unknown>,
  keys: string[]
): number | null {
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

  return null;
}

async function main() {
  const serverUrl = getEnv(
    'SYNC_ERP_MCP_URL',
    'http://localhost:3001/mcp/sse'
  );
  const authHeaders = getAuthHeaders();
  const transport = new SSEClientTransport(new URL(serverUrl), {
    requestInit: { headers: authHeaders },
    eventSourceInit: {
      fetch: createAuthFetch(),
    },
  });
  const client = new Client({
    name: 'sync-erp-mcp-smoke',
    version: '1.0.0',
  });

  try {
    await client.connect(transport);

    const tools = await client.listTools();
    console.log(`Connected. Tools available: ${tools.tools.length}`);

    const companiesPayload = await callJsonTool(client, 'company_list', {});
    const companies = ensureArray<Record<string, unknown>>(
      companiesPayload,
      'company_list'
    );

    if (companies.length === 0) {
      throw new Error('No companies available for MCP smoke test.');
    }

    const preferredCompanyId = process.env.SYNC_ERP_MCP_COMPANY_ID;
    const company =
      companies.find(
        (item) => preferredCompanyId && item.id === preferredCompanyId
      ) || companies[0];
    const companyId = pickId(company, 'Selected company');

    console.log(`Using company: ${companyId}`);

    const accountsPayload = await callJsonTool(
      client,
      'finance_accounts_list',
      { companyId }
    );
    const accounts = ensureArray<Record<string, unknown>>(
      accountsPayload,
      'finance_accounts_list'
    );
    if (accounts.length === 0) {
      throw new Error('Chart of accounts is empty.');
    }

    console.log(`Accounts loaded: ${accounts.length}`);

    const customersPayload = await callJsonTool(client, 'partner_list', {
      companyId,
      type: 'CUSTOMER',
    });
    const customers = ensureArray<Record<string, unknown>>(
      customersPayload,
      'partner_list'
    );
    if (customers.length === 0) {
      throw new Error('No customer partners available.');
    }

    const productsPayload = await callJsonTool(client, 'product_list', {
      companyId,
    });
    const products = ensureArray<Record<string, unknown>>(
      productsPayload,
      'product_list'
    );
    if (products.length === 0) {
      throw new Error('No products available.');
    }

    const customerId = pickId(customers[0], 'Selected customer');
    const sellableProduct =
      products.find((product) => {
        const stockQty = pickOptionalNumber(
          ensureRecord(product, 'Product'),
          ['stockQty', 'stock']
        );
        return stockQty === null || stockQty > 0;
      }) ?? products[0];
    const productRecord = ensureRecord(
      sellableProduct,
      'Selected product'
    );
    const productId = pickId(productRecord, 'Selected product');
    const unitPrice = pickNumber(
      productRecord,
      ['price', 'sellingPrice'],
      'Selected product price'
    );
    const currentStockQty =
      pickOptionalNumber(productRecord, ['stockQty', 'stock']) ?? 0;
    const smokeQuantity = 1;
    const reference = `MCP-SMOKE-${Date.now()}`;

    if (currentStockQty < smokeQuantity) {
      await callJsonTool(client, 'inventory_adjust_stock', {
        companyId,
        productId,
        quantity: smokeQuantity - currentStockQty + 5,
        costPerUnit:
          pickOptionalNumber(productRecord, ['averageCost', 'cost']) ??
          unitPrice,
        reference: `${reference}-STOCK-TOPUP`,
      });
      console.log(`Stock topped up for product: ${productId}`);
    }

    const salesOrderPayload = await callJsonTool(
      client,
      'sales_order_create',
      {
        companyId,
        partnerId: customerId,
        reference,
        notes: 'Smoke test via MCP SSE',
        items: JSON.stringify([
          {
            productId,
            quantity: smokeQuantity,
            price: unitPrice,
          },
        ]),
      }
    );
    const salesOrder = ensureRecord(
      salesOrderPayload,
      'sales_order_create'
    );
    const salesOrderId = pickId(salesOrder, 'Sales order');
    console.log(`Sales order created: ${salesOrderId}`);

    await callJsonTool(client, 'sales_order_confirm', {
      companyId,
      id: salesOrderId,
    });
    await callJsonTool(client, 'sales_order_ship', {
      companyId,
      id: salesOrderId,
      reference: `${reference}-SHIP`,
    });
    console.log(`Sales order confirmed and shipped: ${salesOrderId}`);

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

    const paymentPayload = await callJsonTool(client, 'payment_create', {
      companyId,
      input: JSON.stringify({
        invoiceId,
        amount: invoiceAmount,
        method: 'CASH',
        reference: `${reference}-PAY`,
        correlationId: randomUUID(),
      }),
    });
    const payment = ensureRecord(paymentPayload, 'payment_create');
    const paymentId = pickId(payment, 'Payment');
    console.log(`Payment recorded: ${paymentId}`);

    const journalsPayload = await callJsonTool(
      client,
      'finance_journals_list',
      { companyId }
    );
    const journals = ensureArray<Record<string, unknown>>(
      journalsPayload,
      'finance_journals_list'
    );
    if (journals.length === 0) {
      throw new Error('No journals found after sales recording.');
    }

    console.log(
      JSON.stringify(
        {
          success: true,
          companyId,
          salesOrderId,
          invoiceId,
          paymentId,
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
