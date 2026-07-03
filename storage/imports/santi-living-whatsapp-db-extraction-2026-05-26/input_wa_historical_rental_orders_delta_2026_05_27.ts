import fs from 'node:fs';
import path from 'node:path';
import { apiMutation, apiQuery } from '/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/apps/mcp/src/client.ts';

const COMPANY_ID = 'f023d223-f787-4007-9660-1bfa155c6ec4';
const OUT_DIR =
  '/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-whatsapp-db-extraction-2026-05-26';
const EVIDENCE_FILE = path.join(
  OUT_DIR,
  'carla-state-invoice-evidence-raw-2026-05-27.txt'
);
const IMPORT_BATCH = 'santi-living-wa-historical-orders-delta-2026-05-27';
const RESULT_JSON = path.join(
  OUT_DIR,
  'santi-living-wa-historical-orders-delta-input-result-2026-05-27.json'
);
const RESULT_MD = path.join(
  OUT_DIR,
  'santi-living-wa-historical-orders-delta-input-verification-2026-05-27.md'
);

type JsonRecord = Record<string, unknown>;

type DeltaOrder = {
  invoiceRef: string;
  sourceRef: string;
  partnerName: string;
  customer: string;
  location: string;
  startDate: string;
  endDate: string;
  nights: number;
  rentalItemSku: string;
  itemLabel: string;
  quantity: number;
  pricePerDay: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  dp: number;
  remaining: number;
  evidence: string;
  invoiceText: string;
};

const ORDER: DeltaOrder = {
  invoiceRef: 'SL-WA-022',
  sourceRef: 'WA-22-DAPIE-JAKAL-KM9',
  partnerName: 'Cust SL d@π1€£ - Jakal KM9',
  customer: 'Danie',
  location: 'Jakal KM 9',
  startDate: '2026-02-20',
  endDate: '2026-02-22',
  nights: 2,
  rentalItemSku: 'RGE-120-BIRU',
  itemLabel: 'Kasur 120 Non Paket',
  quantity: 1,
  pricePerDay: 35000,
  subtotal: 70000,
  deliveryFee: 43000,
  total: 113000,
  dp: 0,
  remaining: 113000,
  evidence:
    'WhatsApp Web Chrome profile Santi Living search/open retry 2026-05-27; AX row shows full invoice for Cust SL d@π1€£ - Jakal KM9 on 2026-02-20.',
  invoiceText:
    'Nama: Danie; Lokasi: Jakal KM 9; Tanggal Kirim: 20 Februari 2026; Tanggal Kembali: 22 Februari 2026 pagi; Durasi Sewa: 2 hari; Non Paket Kasur 120 x1 @35000 x2 = 70000; Ongkir 43000; Total 113000.',
};

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected object JSON response');
  }
  return value as JsonRecord;
}

function asArray(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) {
    throw new Error('Expected array JSON response');
  }
  return value.map(asRecord);
}

function parseResponse(raw: string): unknown {
  return JSON.parse(raw);
}

function getString(record: JsonRecord, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
}

function noteValue(notes: unknown, key: string): string {
  if (typeof notes !== 'string') return '';
  const prefix = `${key}=`;
  const line = notes
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(prefix));
  return line ? line.slice(prefix.length).trim() : '';
}

function invoiceRef(order: JsonRecord): string {
  return noteValue(order.notes, 'invoice_ref');
}

function localMidnightIso(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1, 17, 0, 0)).toISOString();
}

function localDueIso(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 4, 0, 0)).toISOString();
}

function toLocalDate(value: unknown): string {
  if (typeof value !== 'string') return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function buildNotes(spec: DeltaOrder): string {
  return [
    `invoice_ref=${spec.invoiceRef}`,
    `source_ref=${spec.sourceRef}`,
    `source=whatsapp_web_chrome_profile_santi_living_retry`,
    `evidence=${spec.evidence}`,
    `evidence_file=${EVIDENCE_FILE}`,
    `customer=${spec.customer}`,
    `location=${spec.location}`,
    `dp=${spec.dp}`,
    `remaining=${spec.remaining}`,
    `invoice_subtotal=${spec.subtotal}`,
    `delivery_fee=${spec.deliveryFee}`,
    `delivery_raw=Ongkir Rp43.000`,
    `invoice_total=${spec.total}`,
    `invoice_items=${spec.itemLabel} x${spec.quantity} @${spec.pricePerDay} x${spec.nights}`,
    `invoice_text=${spec.invoiceText}`,
    `import_method=sync_erp_api_via_mcp_client`,
    `import_batch=${IMPORT_BATCH}`,
  ].join('\n');
}

async function listAllOrders(): Promise<JsonRecord[]> {
  const orders: JsonRecord[] = [];
  let cursor: string | undefined;

  do {
    const payload: JsonRecord = { take: 100 };
    if (cursor) payload.cursor = cursor;
    const response = asRecord(
      parseResponse(await apiQuery('rental.orders.list', payload, COMPANY_ID))
    );
    orders.push(...asArray(response.items));
    cursor =
      typeof response.nextCursor === 'string'
        ? response.nextCursor
        : undefined;
  } while (cursor);

  return orders;
}

function skuForRentalItem(item: JsonRecord): string {
  const product = asRecord(item.product ?? {});
  return (
    getString(product, 'sku') ||
    getString(item, 'sku') ||
    getString(item, 'productSku')
  );
}

async function main(): Promise<void> {
  if (ORDER.quantity * ORDER.pricePerDay * ORDER.nights !== ORDER.subtotal) {
    throw new Error('Item subtotal does not match order subtotal');
  }
  if (ORDER.subtotal + ORDER.deliveryFee !== ORDER.total) {
    throw new Error('Subtotal plus delivery does not match total');
  }
  if (ORDER.total - ORDER.dp !== ORDER.remaining) {
    throw new Error('Total minus DP does not match remaining');
  }

  const [partners, rentalItems, ordersBefore] = await Promise.all([
    apiQuery('partner.list', { type: 'CUSTOMER' }, COMPANY_ID).then((raw) =>
      asArray(parseResponse(raw))
    ),
    apiQuery('rental.items.list', {}, COMPANY_ID).then((raw) =>
      asArray(parseResponse(raw))
    ),
    listAllOrders(),
  ]);

  const existing = ordersBefore.find(
    (order) =>
      invoiceRef(order) === ORDER.invoiceRef ||
      (typeof order.notes === 'string' &&
        order.notes.includes(`source_ref=${ORDER.sourceRef}`))
  );

  const partner = partners.find(
    (candidate) => getString(candidate, 'name') === ORDER.partnerName
  );
  if (!partner) {
    throw new Error(`Partner not found: ${ORDER.partnerName}`);
  }

  const rentalItem = rentalItems.find(
    (candidate) => skuForRentalItem(candidate) === ORDER.rentalItemSku
  );
  if (!rentalItem) {
    throw new Error(`Rental item not found: ${ORDER.rentalItemSku}`);
  }

  const result = existing
    ? { action: 'reused', order: existing }
    : {
        action: 'created',
        order: asRecord(
          parseResponse(
            await apiMutation(
              'rental.orders.create',
              {
                partnerId: getString(partner, 'id'),
                rentalStartDate: localMidnightIso(ORDER.startDate),
                rentalEndDate: localMidnightIso(ORDER.endDate),
                dueDateTime: localDueIso(ORDER.endDate),
                deliveryAddress: ORDER.location,
                items: [
                  {
                    rentalItemId: getString(rentalItem, 'id'),
                    quantity: ORDER.quantity,
                    pricePerDay: ORDER.pricePerDay,
                  },
                ],
                deliveryFee: ORDER.deliveryFee,
                notes: buildNotes(ORDER),
              },
              COMPANY_ID
            )
          )
        ),
      };

  const createdOrder = asRecord(result.order);
  if (toNumber(createdOrder.totalAmount) !== ORDER.total) {
    throw new Error(
      `Order total ${toNumber(createdOrder.totalAmount)} != expected ${ORDER.total}`
    );
  }

  const ordersAfter = await listAllOrders();
  const slWaOrders = ordersAfter.filter((order) =>
    invoiceRef(order).startsWith('SL-WA-')
  );
  const slInvOrders = ordersAfter.filter((order) =>
    invoiceRef(order).startsWith('SL-INV-')
  );
  const scopedOrders = ordersAfter.filter((order) => {
    const ref = invoiceRef(order);
    return ref.startsWith('SL-WA-') || ref.startsWith('SL-INV-');
  });
  const duplicateRefs = Array.from(
    scopedOrders.reduce((counts, order) => {
      const ref = invoiceRef(order);
      if (ref) counts.set(ref, (counts.get(ref) ?? 0) + 1);
      return counts;
    }, new Map<string, number>())
  ).filter(([, count]) => count > 1);

  const summary = {
    companyId: COMPANY_ID,
    importBatch: IMPORT_BATCH,
    action: result.action,
    order: {
      invoiceRef: ORDER.invoiceRef,
      orderNumber: getString(createdOrder, 'orderNumber'),
      orderId: getString(createdOrder, 'id'),
      partnerName: ORDER.partnerName,
      startDate: toLocalDate(createdOrder.rentalStartDate),
      endDate: toLocalDate(createdOrder.rentalEndDate),
      total: toNumber(createdOrder.totalAmount),
    },
    totals: {
      slWaCount: slWaOrders.length,
      slWaTotal: slWaOrders.reduce(
        (sum, order) => sum + toNumber(order.totalAmount),
        0
      ),
      slInvCount: slInvOrders.length,
      slInvTotal: slInvOrders.reduce(
        (sum, order) => sum + toNumber(order.totalAmount),
        0
      ),
      scopedCount: scopedOrders.length,
      scopedTotal: scopedOrders.reduce(
        (sum, order) => sum + toNumber(order.totalAmount),
        0
      ),
    },
    duplicateRefs,
    unresolvedAfterRetry: [
      'Cust SL - Agashi UNY: Web retry removed explicit older-message button, but invoice before 2026-01-31 still not visible; existing native evidence has conflicting Rp20.000/Rp40.000 candidates.',
      'Cust SL Harza Arbaha Wates KP: Web shows address/payment/refund context but no invoice total or item lines.',
      'Cust SL - Intan Griya Alvita: Web shows route/address/review context and Paket 120 route note, but no invoice total.',
    ],
  };

  fs.writeFileSync(RESULT_JSON, `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(
    RESULT_MD,
    [
      '# Santi Living WA Historical Orders Delta Input - 2026-05-27',
      '',
      `- Batch: ${IMPORT_BATCH}`,
      `- Action: ${summary.action}`,
      `- Input: ${ORDER.invoiceRef} / ${ORDER.customer} / Rp${ORDER.total.toLocaleString('id-ID')}`,
      `- Created/reused order: ${summary.order.orderNumber} (${summary.order.orderId})`,
      `- SL-WA count/total: ${summary.totals.slWaCount} / Rp${summary.totals.slWaTotal.toLocaleString('id-ID')}`,
      `- Combined SL-INV + SL-WA count/total: ${summary.totals.scopedCount} / Rp${summary.totals.scopedTotal.toLocaleString('id-ID')}`,
      `- Duplicate scoped refs: ${summary.duplicateRefs.length ? JSON.stringify(summary.duplicateRefs) : 'none'}`,
      '',
      '## Input Evidence',
      '',
      ORDER.invoiceText,
      '',
      '## Still Unresolved After WhatsApp Web Retry',
      '',
      ...summary.unresolvedAfterRetry.map((item) => `- ${item}`),
      '',
      `Result JSON: ${RESULT_JSON}`,
    ].join('\n')
  );

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
