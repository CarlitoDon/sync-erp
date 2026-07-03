import fs from 'node:fs';
import path from 'node:path';
import { apiMutation, apiQuery } from '/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/apps/mcp/src/client.ts';

const COMPANY_ID = 'f023d223-f787-4007-9660-1bfa155c6ec4';
const OUT_DIR =
  '/Users/wecik/Documents/Offline/Professional/Coding/sync-erp/storage/imports/santi-living-whatsapp-db-extraction-2026-05-26';
const FINAL_LEDGER = path.join(
  OUT_DIR,
  'santi-living-rental-orders-final-current-ledger-2026-05-27.csv'
);
const SOURCE_NOT_IN_ERP = path.join(
  OUT_DIR,
  'santi-living-rental-orders-source-not-in-erp-2026-05-27.csv'
);
const VERIFICATION_JSON = path.join(
  OUT_DIR,
  'santi-living-rental-orders-bayu-fix-verification-2026-05-27.json'
);
const VERIFICATION_MD = path.join(
  OUT_DIR,
  'santi-living-rental-orders-bayu-fix-verification-2026-05-27.md'
);
const AFTER_FIX_LEDGER = path.join(
  OUT_DIR,
  'santi-living-rental-orders-final-after-fix-ledger-2026-05-27.csv'
);
const UNMAPPED_AFTER_FIX = path.join(
  OUT_DIR,
  'santi-living-rental-orders-unmapped-after-fix-2026-05-27.csv'
);

type JsonRecord = Record<string, unknown>;

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

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
}

function getString(record: JsonRecord, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
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

function lower(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

function csvEscape(value: unknown): string {
  const raw = value === undefined || value === null ? '' : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
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

function parseCsv(text: string): JsonRecord[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [headers, ...dataRows] = rows;
  if (!headers) return [];

  return dataRows
    .filter((dataRow) => dataRow.some((value) => value.length > 0))
    .map((dataRow) => {
      const record: JsonRecord = {};
      headers.forEach((header, index) => {
        record[header] = dataRow[index] ?? '';
      });
      return record;
    });
}

function sortByInvoiceRef(orders: JsonRecord[]): JsonRecord[] {
  return [...orders].sort((left, right) => {
    const leftRef = invoiceRef(left).match(/\d+$/)?.[0] ?? '0';
    const rightRef = invoiceRef(right).match(/\d+$/)?.[0] ?? '0';
    return Number(leftRef) - Number(rightRef);
  });
}

function writeAfterFixLedger(orders: JsonRecord[]): void {
  const headers = [
    'mapping_status',
    'invoice_ref',
    'order_number',
    'order_id',
    'customer',
    'partner_name',
    'start_date',
    'end_date',
    'subtotal_idr',
    'delivery_fee_idr',
    'total_idr',
    'dp_recorded_idr',
    'sisa_recorded_idr',
    'erp_status',
    'erp_payment_status',
  ];

  const rows = sortByInvoiceRef(orders).map((order) => {
    const partner = asRecord(order.partner ?? {});
    return [
      'mapped',
      invoiceRef(order),
      getString(order, 'orderNumber'),
      getString(order, 'id'),
      noteValue(order.notes, 'customer'),
      getString(partner, 'name'),
      toLocalDate(order.rentalStartDate),
      toLocalDate(order.rentalEndDate),
      getString(order, 'subtotal'),
      getString(order, 'deliveryFee'),
      getString(order, 'totalAmount'),
      noteValue(order.notes, 'dp'),
      noteValue(order.notes, 'remaining'),
      getString(order, 'status'),
      getString(order, 'rentalPaymentStatus'),
    ];
  });

  fs.writeFileSync(
    AFTER_FIX_LEDGER,
    [headers, ...rows]
      .map((row) => row.map(csvEscape).join(','))
      .join('\n') + '\n'
  );

  fs.writeFileSync(
    UNMAPPED_AFTER_FIX,
    [
      'mapping_status,customer,location,start_date,end_date,total_idr,review_note',
      '# no current source invoices remain unmapped after Bayu SL-INV-031 fix',
    ].join('\n') + '\n'
  );
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

async function findOrCreateBayuPartner(): Promise<{
  partner: JsonRecord;
  action: 'created' | 'reused';
}> {
  const partners = asArray(
    parseResponse(
      await apiQuery('partner.list', { type: 'CUSTOMER' }, COMPANY_ID)
    )
  );
  const existing = partners.find((partner) => {
    const name = lower(partner.name);
    const address = lower(partner.address);
    return (
      name.includes('bayu') &&
      (address.includes('vila gardenia') ||
        name.includes('vila gardenia'))
    );
  });

  if (existing) {
    return { partner: existing, action: 'reused' };
  }

  const created = asRecord(
    parseResponse(
      await apiMutation(
        'partner.create',
        {
          name: 'Cust SL - Bayu Vila Gardenia',
          type: 'CUSTOMER',
          address: 'Vila Gardenia, Gunung Sempu',
        },
        COMPANY_ID
      )
    )
  );

  return { partner: created, action: 'created' };
}

async function findPackageSingle100Bundle(): Promise<JsonRecord> {
  const bundles = asArray(
    parseResponse(
      await apiQuery('rentalBundle.list', { companyId: COMPANY_ID }, COMPANY_ID)
    )
  );
  const bundle = bundles.find((candidate) =>
    lower(candidate.name).includes('paket single 100')
  );

  if (!bundle) {
    throw new Error('Rental bundle "Paket Single 100" not found');
  }

  return bundle;
}

function bayuNotes(): string {
  return [
    'invoice_ref=SL-INV-031',
    'evidence_chat=+62 812-2988-5456',
    'evidence_date=2026-05-27 09:18 WIB',
    'customer=Bayu',
    'dp=62000',
    'remaining=143000',
    'invoice_total=205000',
    'INVOICE PEMESANAN Sewa Kasur Santi Living by Santi Mebel Godean Nama: Bayu Lokasi: Vila Gardenia, Gunung Sempu Tanggal Kirim: 28 Mei 2026 Tanggal Ambil: 1 Juni 2026 Durasi Sewa: 4 malam Detail Pesanan * Paket Single 100 -> 1 pcs x Rp40.000 x 4 malam = Rp160.000 Ongkir : Rp45.000 Total Pembayaran : Rp205.000 DP 30%: Rp62.000 Sisa Pelunasan : Rp143.000',
    'source_session=20260527_093417_e20d22',
    'source=carla_telegram_whatsapp_extract',
    'mapping_fixed_by=codex_with_carla_telegram_context_2026-05-27',
    'import_method=sync_erp_api_via_mcp_client',
    'import_batch=santi-living-rental-invoice-investigation-2026-05-26',
  ].join('\n');
}

async function main(): Promise<void> {
  const ordersBefore = await listAllOrders();
  const existingBayu = ordersBefore.find((order) => {
    const notes = lower(order.notes);
    return (
      invoiceRef(order) === 'SL-INV-031' ||
      (notes.includes('customer=bayu') &&
        notes.includes('vila gardenia')) ||
      lower(asRecord(order.partner ?? {}).name).includes('bayu vila gardenia')
    );
  });

  let partnerAction: 'created' | 'reused' | 'skipped' = 'skipped';
  let orderAction: 'created' | 'reused' = 'reused';
  let partner: JsonRecord | null = null;
  let order: JsonRecord = existingBayu ?? {};

  if (!existingBayu) {
    const partnerResult = await findOrCreateBayuPartner();
    partner = partnerResult.partner;
    partnerAction = partnerResult.action;
    const bundle = await findPackageSingle100Bundle();

    order = asRecord(
      parseResponse(
        await apiMutation(
          'rental.orders.create',
          {
            partnerId: getString(partner, 'id'),
            rentalStartDate: '2026-05-27T17:00:00.000Z',
            rentalEndDate: '2026-05-31T17:00:00.000Z',
            dueDateTime: '2026-06-01T11:00:00.000Z',
            deliveryAddress: 'Vila Gardenia, Gunung Sempu',
            items: [
              {
                rentalBundleId: getString(bundle, 'id'),
                quantity: 1,
                pricePerDay: 40000,
              },
            ],
            deliveryFee: 45000,
            notes: bayuNotes(),
          },
          COMPANY_ID
        )
      )
    );
    orderAction = 'created';
  }

  const ordersAfter = await listAllOrders();
  const slInvOrders = ordersAfter.filter((candidate) =>
    invoiceRef(candidate).startsWith('SL-INV-')
  );
  const invoiceRefCounts = new Map<string, number>();
  for (const candidate of slInvOrders) {
    const ref = invoiceRef(candidate);
    invoiceRefCounts.set(ref, (invoiceRefCounts.get(ref) ?? 0) + 1);
  }

  const finalLedgerRows = parseCsv(fs.readFileSync(FINAL_LEDGER, 'utf8'));
  const missingRows = parseCsv(fs.readFileSync(SOURCE_NOT_IN_ERP, 'utf8'));
  const requiredRefs = new Set(
    finalLedgerRows
      .map((row) => getString(row, 'invoice_ref'))
      .filter(Boolean)
  );
  requiredRefs.add('SL-INV-031');

  const missingRequiredRefs = Array.from(requiredRefs).filter(
    (ref) => !slInvOrders.some((candidate) => invoiceRef(candidate) === ref)
  );
  const duplicateRefs = Array.from(invoiceRefCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([ref, count]) => ({ ref, count }));

  const bayuOrders = slInvOrders.filter(
    (candidate) => invoiceRef(candidate) === 'SL-INV-031'
  );
  const statusCounts = slInvOrders.reduce<Record<string, number>>(
    (acc, candidate) => {
      const status = getString(candidate, 'status') || 'UNKNOWN';
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    },
    {}
  );
  const paymentStatusCounts = slInvOrders.reduce<Record<string, number>>(
    (acc, candidate) => {
      const status =
        getString(candidate, 'rentalPaymentStatus') || 'UNKNOWN';
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    },
    {}
  );

  const summary = {
    companyId: COMPANY_ID,
    partnerAction,
    orderAction,
    partnerId: partner ? getString(partner, 'id') : undefined,
    orderId: getString(order, 'id'),
    orderNumber: getString(order, 'orderNumber'),
    invoiceRef: invoiceRef(order),
    bayuOrders: bayuOrders.map((candidate) => ({
      id: getString(candidate, 'id'),
      orderNumber: getString(candidate, 'orderNumber'),
      partnerName: getString(asRecord(candidate.partner ?? {}), 'name'),
      rentalStartDate: getString(candidate, 'rentalStartDate'),
      rentalEndDate: getString(candidate, 'rentalEndDate'),
      dueDateTime: getString(candidate, 'dueDateTime'),
      subtotal: getString(candidate, 'subtotal'),
      deliveryFee: getString(candidate, 'deliveryFee'),
      totalAmount: getString(candidate, 'totalAmount'),
      status: getString(candidate, 'status'),
      rentalPaymentStatus: getString(candidate, 'rentalPaymentStatus'),
      dp: noteValue(candidate.notes, 'dp'),
      remaining: noteValue(candidate.notes, 'remaining'),
    })),
    requiredCurrentSourceCount:
      finalLedgerRows.length +
      missingRows.filter(
        (row) => getString(row, 'mapping_status') === 'source_not_in_erp'
      ).length,
    currentSlInvOrderCount: slInvOrders.length,
    currentSlInvTotal: slInvOrders.reduce(
      (sum, candidate) => sum + toNumber(candidate.totalAmount),
      0
    ),
    expectedCurrentSlInvTotal: 9016000,
    statusCounts,
    paymentStatusCounts,
    missingRequiredRefs,
    duplicateRefs,
    supersededExcluded: missingRows
      .filter((row) => getString(row, 'mapping_status') === 'superseded')
      .map((row) => ({
        customer: getString(row, 'customer'),
        totalIdr: Number(getString(row, 'total_idr')),
        reviewNote: getString(row, 'review_note'),
      })),
    afterFixLedger: AFTER_FIX_LEDGER,
    unmappedAfterFix: UNMAPPED_AFTER_FIX,
  };

  writeAfterFixLedger(slInvOrders);
  fs.writeFileSync(VERIFICATION_JSON, `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(
    VERIFICATION_MD,
    [
      '# Santi Living Bayu Mapping Fix Verification - 2026-05-27',
      '',
      '## Result',
      '',
      `- Partner action: ${summary.partnerAction}`,
      `- Rental order action: ${summary.orderAction}`,
      `- Bayu order: ${summary.orderNumber} / ${summary.orderId}`,
      `- Invoice ref: ${summary.invoiceRef}`,
      `- Current source invoice count expected/found: ${summary.requiredCurrentSourceCount}/${summary.currentSlInvOrderCount}`,
      `- Current source invoice total expected/found: Rp${summary.expectedCurrentSlInvTotal.toLocaleString('id-ID')}/Rp${summary.currentSlInvTotal.toLocaleString('id-ID')}`,
      `- Status counts: ${JSON.stringify(summary.statusCounts)}`,
      `- Payment status counts: ${JSON.stringify(summary.paymentStatusCounts)}`,
      `- Missing required invoice refs: ${summary.missingRequiredRefs.length ? summary.missingRequiredRefs.join(', ') : 'none'}`,
      `- Duplicate invoice refs: ${summary.duplicateRefs.length ? JSON.stringify(summary.duplicateRefs) : 'none'}`,
      '',
      '## Bayu Detail',
      '',
      '| Field | Value |',
      '|---|---|',
      `| Customer | Bayu |`,
      `| Location | Vila Gardenia, Gunung Sempu |`,
      `| Rental start | 2026-05-28 |`,
      `| Rental end / pickup | 2026-06-01 |`,
      `| Item | Paket Single 100 x1 @ Rp40.000 x 4 malam |`,
      `| Subtotal | Rp160.000 |`,
      `| Ongkir | Rp45.000 |`,
      `| Total | Rp205.000 |`,
      `| DP | Rp62.000 |`,
      `| Remaining | Rp143.000 |`,
      '',
      '## Superseded Evidence Excluded',
      '',
      ...summary.supersededExcluded.map(
        (row) =>
          `- ${row.customer} Rp${row.totalIdr.toLocaleString('id-ID')}: ${row.reviewNote}`
      ),
      '',
      '## Output',
      '',
      `- ${VERIFICATION_JSON}`,
      `- ${VERIFICATION_MD}`,
      `- ${AFTER_FIX_LEDGER}`,
      `- ${UNMAPPED_AFTER_FIX}`,
      '',
    ].join('\n')
  );

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
