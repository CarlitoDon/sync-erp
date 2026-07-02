import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const COMPANY_ID = 'f023d223-f787-4007-9660-1bfa155c6ec4';
const COMPANY_NAME = 'Santi Living';
const MCP_URL = process.env.SYNC_ERP_MCP_URL ?? 'http://127.0.0.1:3005/mcp';
const APPLY = process.argv.includes('--apply');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const SOURCE_DIR = path.join(
  REPO_ROOT,
  'storage/imports/santi-living-google-sheets-pengiriman-2026-05-28'
);
const HEADER_CSV = path.join(SOURCE_DIR, 'codex-erp-import-prep-order-headers.csv');
const LINE_CSV = path.join(SOURCE_DIR, 'codex-erp-import-prep-order-lines.csv');

const batchArg = process.argv
  .find((arg) => arg.startsWith('--batch='))
  ?.slice('--batch='.length);

const BATCHES = {
  'clean-unmatched': {
    name: 'clean-unmatched',
    outputSlug: 'clean-unmatched',
    allowedReadiness: new Set(['auto_import_candidate']),
    expectedCount: 11,
    expectedTotal: 4338000,
    orderIds: [
      'ORD-001',
      'ORD-002',
      'ORD-007',
      'ORD-023',
      'ORD-026',
      'ORD-027',
      'ORD-029',
      'ORD-032',
      'ORD-033',
      'ORD-034',
      'ORD-039',
    ],
    scopeNote:
      'Clean unmatched Google Sheet rows with exact line totals and no conflicting existing ERP order.',
    reviewNote: '',
  },
  'review-line-detail': {
    name: 'review-line-detail',
    outputSlug: 'review-line-detail',
    allowedReadiness: new Set(['needs_review_line_detail']),
    expectedCount: 3,
    expectedTotal: 785000,
    orderIds: ['ORD-003', 'ORD-004', 'ORD-006'],
    scopeNote:
      'Reviewed daftar_pesanan rows with valid order totals; item line split is allocated from source subtotal and preserved in notes.',
    reviewNote:
      'review_line_detail_accepted=true; item split uses sheet_item_subtotal_allocated_by_base_rate because source sheet gives reliable order total but not per-line invoice prices.',
  },
  'source-conflict-resolved': {
    name: 'source-conflict-resolved',
    outputSlug: 'source-conflict-resolved',
    allowedReadiness: new Set(['needs_review_source_conflict']),
    expectedCount: 2,
    expectedTotal: 463000,
    orderIds: ['ORD-013', 'ORD-020'],
    scopeNote:
      'Resolved source conflicts using Pengiriman operational sheet: delivery fee delta for ORD-013 and full-item extension without extra delivery fee for ORD-020.',
    reviewNote:
      'source_conflict_resolved=true; pengiriman operational sheet used as final amount basis where daftar_pesanan and main_pengiriman disagreed.',
    overridesByOrderId: {
      'ORD-013': {
        deliveryFeeNetIdr: 21000,
        finalTotalIdr: 168000,
        note:
          'main_pengiriman_row=6 final_total_idr=168000; daftar item subtotal Rp147000 plus delivery delta Rp21000.',
      },
      'ORD-020': {
        finalTotalIdr: 295000,
        finalRentalEndDate: '2026-03-29',
        note:
          'main_pengiriman_row=17 actual pickup 2026-03-29 from Pengiriman sheet; final_total_idr=295000 after removing non-applicable full-extension delivery fee.',
        extension: {
          newEndDate: '2026-03-29',
          additionalAmount: 177000,
          deliveryFee: 0,
          reason:
            'Historical full-item extension from daftar end 2026-03-26 to actual pickup 2026-03-29; no extra delivery fee for full extension.',
        },
      },
    },
  },
};

const BATCH = BATCHES[batchArg ?? 'clean-unmatched'];
if (!BATCH) {
  throw new Error(`Unknown batch "${batchArg}". Available: ${Object.keys(BATCHES).join(', ')}`);
}

const RESULT_CSV = path.join(
  SOURCE_DIR,
  `codex-${BATCH.outputSlug}-import-result-2026-05-28.csv`
);
const RESULT_MD = path.join(
  SOURCE_DIR,
  `codex-${BATCH.outputSlug}-import-result-2026-05-28.md`
);

const IMPORT_BATCH = `santi-living-google-sheets-pengiriman-2026-05-28-${BATCH.name}`;
const ORDER_IDS_TO_IMPORT = new Set(BATCH.orderIds);

const BUNDLE_DEFS = [
  {
    externalId: 'PKG-SINGLE-90',
    name: 'Paket Single 90',
    shortName: 'Single 90',
    dailyRate: 35000,
    weeklyRate: 210000,
    monthlyRate: 875000,
    components: [{ sku: 'RGE-90-BIRU', quantity: 1, componentLabel: 'Royal Grand Exclusive 90 Biru' }],
  },
  {
    externalId: 'PKG-SINGLE-100',
    name: 'Paket Single 100',
    shortName: 'Single 100',
    dailyRate: 40000,
    weeklyRate: 240000,
    monthlyRate: 1000000,
    components: [{ sku: 'RGE-100-BIRU', quantity: 1, componentLabel: 'Royal Grand Exclusive 100 Biru' }],
  },
  {
    externalId: 'PKG-DOUBLE-120',
    name: 'Paket Double 120',
    shortName: 'Double 120',
    dailyRate: 45000,
    weeklyRate: 270000,
    monthlyRate: 1125000,
    components: [{ sku: 'RGE-120-BIRU', quantity: 1, componentLabel: 'Royal Grand Exclusive 120 Biru' }],
  },
  {
    externalId: 'PKG-QUEEN-160',
    name: 'Paket Queen 160',
    shortName: 'Queen 160',
    dailyRate: 55000,
    weeklyRate: 330000,
    monthlyRate: 1375000,
    components: [{ sku: 'RGE-160-BIRU', quantity: 1, componentLabel: 'Royal Grand Exclusive 160 Biru' }],
  },
  {
    externalId: 'ADDON-BANTAL-UNTRACKED',
    name: 'Add on Bantal (Untracked)',
    shortName: 'Bantal',
    dailyRate: 7000,
    weeklyRate: 42000,
    monthlyRate: 175000,
    description: 'Revenue-only add-on from source invoice; source does not identify pillow brand.',
    components: [],
  },
  {
    externalId: 'ADDON-SELIMUT-UNTRACKED',
    name: 'Add on Selimut (Untracked)',
    shortName: 'Selimut',
    dailyRate: 10000,
    weeklyRate: 60000,
    monthlyRate: 250000,
    description: 'Revenue-only add-on from source invoice.',
    components: [],
  },
  {
    externalId: 'ADDON-SPREI-UNTRACKED',
    name: 'Add on Sprei (Untracked)',
    shortName: 'Sprei',
    dailyRate: 10000,
    weeklyRate: 60000,
    monthlyRate: 250000,
    description: 'Revenue-only add-on from source invoice.',
    components: [],
  },
  {
    externalId: 'ADDON-KIPAS-UNTRACKED',
    name: 'Kipas Angin (Untracked)',
    shortName: 'Kipas',
    dailyRate: 20000,
    weeklyRate: 120000,
    monthlyRate: 500000,
    description: 'Revenue-only add-on from source invoice; invoice line price remains authoritative.',
    components: [],
  },
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value !== '')) rows.push(row);
  }

  const [headers, ...records] = rows;
  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? '']))
  );
}

function numberValue(value) {
  if (value === undefined || value === null || value === '') return 0;
  return Number(String(value).replace(/[^\d.-]/g, ''));
}

function overrideFor(row) {
  return BATCH.overridesByOrderId?.[row.order_id] ?? {};
}

function deliveryFeeNet(row) {
  return overrideFor(row).deliveryFeeNetIdr ?? numberValue(row.delivery_fee_net_idr);
}

function lineTotalFor(row, lineRows) {
  return lineRows
    .filter((line) => line.order_id === row.order_id)
    .reduce((sum, line) => sum + numberValue(line.line_total_idr), 0);
}

function createTotalFor(row, lineRows) {
  return overrideFor(row).createTotalIdr ?? lineTotalFor(row, lineRows) + deliveryFeeNet(row);
}

function finalTotalFor(row, lineRows) {
  return overrideFor(row).finalTotalIdr ?? createTotalFor(row, lineRows);
}

function idr(value) {
  return `Rp${Number(value).toLocaleString('id-ID')}`;
}

function csvEscape(value) {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toBusinessIso(date) {
  return new Date(`${date}T12:00:00+07:00`).toISOString();
}

const localDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function localDate(value) {
  return localDateFormatter.format(new Date(value));
}

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/cust sl|cust|sl|pak|bu|mas|mbak|[^a-z0-9]+/g, ' ')
    .trim();
}

function toArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function parseToolJson(result, toolName) {
  if (result.isError) {
    throw new Error(`${toolName} failed: ${result.content?.map((part) => part.text).join('\n')}`);
  }
  const text = result.content?.[0]?.text ?? '';
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function callTool(client, name, args) {
  const result = await client.callTool({ name, arguments: args });
  return parseToolJson(result, name);
}

function orderRefFromNotes(notes) {
  return String(notes ?? '').match(/(?:sheet_order_id|order_ref)=([A-Za-z0-9._/-]+)/)?.[1] ?? null;
}

function partnerName(row) {
  return `Cust SL - ${row.customer_name}`.trim();
}

function duplicateFor(row, existingOrders) {
  const targetRef = row.order_id;
  const targetName = normalize(row.customer_name);
  const targetTotal = numberValue(row.total_invoice_idr);
  return existingOrders.find((order) => {
    if (orderRefFromNotes(order.notes) === targetRef) return true;
    const orderName = normalize(order.partner?.name);
    const sameName =
      targetName &&
      orderName &&
      (orderName.includes(targetName) || targetName.includes(orderName));
    return (
      sameName &&
      row.rental_start_date === localDate(order.rentalStartDate) &&
      row.rental_end_date === localDate(order.rentalEndDate) &&
      targetTotal === numberValue(order.totalAmount)
    );
  });
}

function validateRows(orderRows, lineRows) {
  const rows = orderRows.filter((row) => ORDER_IDS_TO_IMPORT.has(row.order_id));
  const errors = [];

  const missingIds = [...ORDER_IDS_TO_IMPORT].filter(
    (orderId) => !rows.some((row) => row.order_id === orderId)
  );
  if (missingIds.length > 0) errors.push(`Missing target rows: ${missingIds.join(', ')}`);

  for (const row of rows) {
    if (!BATCH.allowedReadiness.has(row.import_readiness)) {
      errors.push(
        `${row.order_id} readiness ${row.import_readiness} is not allowed for batch ${BATCH.name}`
      );
    }

    const lines = lineRows.filter((line) => line.order_id === row.order_id);
    if (lines.length === 0) errors.push(`${row.order_id} has no lines`);

    const lineTotal = lineTotalFor(row, lineRows);
    const expected = lineTotal + deliveryFeeNet(row);
    const total = createTotalFor(row, lineRows);
    if (expected !== total) {
      errors.push(
        `${row.order_id} total mismatch: lines ${lineTotal} + delivery ${deliveryFeeNet(row)} = ${expected}, create total ${total}`
      );
    }

    for (const line of lines) {
      if (!line.rental_bundle_external_key && !line.rental_item_sku) {
        errors.push(`${row.order_id} line ${line.line_no} missing bundle key or rental item sku`);
      }
      if (numberValue(line.qty) <= 0) {
        errors.push(`${row.order_id} line ${line.line_no} has invalid qty ${line.qty}`);
      }
      if (numberValue(line.line_total_idr) <= 0) {
        errors.push(`${row.order_id} line ${line.line_no} has invalid line total ${line.line_total_idr}`);
      }
    }
  }

  return { rows, errors };
}

function buildOrderInput(row, lines, bundleIdsByExternalId, rentalItemIdsBySku, partnerId) {
  const items = lines.map((line) => {
    const item = {
      quantity: numberValue(line.qty),
      lineTotal: numberValue(line.line_total_idr),
    };
    if (line.rental_bundle_external_key) {
      const rentalBundleId = bundleIdsByExternalId.get(line.rental_bundle_external_key);
      if (!rentalBundleId) {
        throw new Error(`${row.order_id}: missing bundle ${line.rental_bundle_external_key}`);
      }
      item.rentalBundleId = rentalBundleId;
    } else {
      const rentalItemId = rentalItemIdsBySku.get(line.rental_item_sku);
      if (!rentalItemId) {
        throw new Error(`${row.order_id}: missing rental item sku ${line.rental_item_sku}`);
      }
      item.rentalItemId = rentalItemId;
    }
    return item;
  });

  const deliveryFee = deliveryFeeNet(row);
  const rowOverride = overrideFor(row);
  return {
    partnerId,
    rentalStartDate: toBusinessIso(row.rental_start_date),
    rentalEndDate: toBusinessIso(row.rental_end_date),
    dueDateTime: toBusinessIso(row.rental_end_date),
    items,
    deliveryFee,
    deliveryAddress: row.delivery_address,
    paymentMethod: 'transfer',
    notes: [
      `sheet_order_id=${row.order_id}`,
      `source=google_sheet_pengiriman`,
      `source_file=source-google-sheet-export-2026-05-28.xlsx`,
      `import_method=codex_mcp_batch`,
      `import_batch=${IMPORT_BATCH}`,
      `source_status=${row.import_readiness}`,
      `settled_source=${row.settled}`,
      `sheet_remaining_idr=${numberValue(row.main_remaining_idr) || numberValue(row.total_invoice_idr) - numberValue(row.settlement_amount_idr)}`,
      `sheet_settlement_amount_idr=${numberValue(row.settlement_amount_idr)}`,
      `delivery_fee_billed_idr=${numberValue(row.delivery_fee_billed_idr)}`,
      `delivery_discount_idr=${numberValue(row.delivery_discount_idr)}`,
      rowOverride.deliveryFeeNetIdr !== undefined
        ? `delivery_fee_net_override_idr=${rowOverride.deliveryFeeNetIdr}`
        : undefined,
      rowOverride.finalTotalIdr !== undefined ? `final_total_idr=${rowOverride.finalTotalIdr}` : undefined,
      rowOverride.finalRentalEndDate ? `final_rental_end_date=${rowOverride.finalRentalEndDate}` : undefined,
      `line_total_authoritative=true`,
      `do_not_infer_price_from_sku=true`,
      rowOverride.note,
      BATCH.reviewNote,
    ].filter(Boolean).join('\n'),
  };
}

async function ensureBundles(client, lineRows) {
  const rentalItems = toArray(await callTool(client, 'rental_item_list', { companyId: COMPANY_ID }));
  const rentalItemIdsBySku = new Map();
  for (const item of rentalItems) {
    if (item.product?.sku) rentalItemIdsBySku.set(item.product.sku, item.id);
  }

  const targetLines = lineRows.filter((line) => ORDER_IDS_TO_IMPORT.has(line.order_id));
  const requiredSkus = new Set(targetLines.map((line) => line.rental_item_sku).filter(Boolean));
  for (const def of BUNDLE_DEFS) {
    for (const component of def.components) requiredSkus.add(component.sku);
  }
  const missingSkus = [...requiredSkus].filter((sku) => !rentalItemIdsBySku.has(sku));
  if (missingSkus.length > 0) throw new Error(`Missing rental item SKUs: ${missingSkus.join(', ')}`);

  let bundles = toArray(await callTool(client, 'rental_bundle_list', { companyId: COMPANY_ID }));
  const bundleIdsByExternalId = new Map();
  for (const bundle of bundles) {
    if (bundle.externalId) bundleIdsByExternalId.set(bundle.externalId, bundle.id);
    const matchingDef = BUNDLE_DEFS.find((def) => def.name === bundle.name);
    if (matchingDef) bundleIdsByExternalId.set(matchingDef.externalId, bundle.id);
  }

  const usedBundleKeys = new Set(
    targetLines.map((line) => line.rental_bundle_external_key).filter(Boolean)
  );
  const bundleActions = [];
  for (const def of BUNDLE_DEFS.filter((bundle) => usedBundleKeys.has(bundle.externalId))) {
    if (bundleIdsByExternalId.has(def.externalId)) {
      bundleActions.push({ externalId: def.externalId, action: 'reuse', id: bundleIdsByExternalId.get(def.externalId) });
      continue;
    }
    if (!APPLY) {
      bundleActions.push({ externalId: def.externalId, action: 'would_create', id: '' });
      bundleIdsByExternalId.set(def.externalId, `dry-run-${def.externalId}`);
      continue;
    }

    const input = {
      companyId: COMPANY_ID,
      externalId: def.externalId,
      name: def.name,
      shortName: def.shortName,
      description: def.description,
      dailyRate: def.dailyRate,
      weeklyRate: def.weeklyRate,
      monthlyRate: def.monthlyRate,
      components: def.components.map((component) => ({
        rentalItemId: rentalItemIdsBySku.get(component.sku),
        quantity: component.quantity,
        componentLabel: component.componentLabel,
      })),
    };
    const created = await callTool(client, 'rental_bundle_create', {
      companyId: COMPANY_ID,
      input: JSON.stringify(input),
    });
    bundleIdsByExternalId.set(def.externalId, created.id);
    bundleActions.push({ externalId: def.externalId, action: 'created', id: created.id });
  }

  return { rentalItemIdsBySku, bundleIdsByExternalId, bundleActions };
}

async function applyConfiguredExtension(client, row, lineRows, createdOrder) {
  const extension = overrideFor(row).extension;
  if (!extension) return createdOrder;

  const order = await callTool(client, 'rental_order_get', {
    companyId: COMPANY_ID,
    id: createdOrder.id,
  });
  const lines = lineRows.filter((line) => line.order_id === row.order_id);
  if (lines.length !== 1) {
    throw new Error(`${row.order_id}: configured extension currently requires exactly one source line`);
  }
  const extensionItems = [];

  for (const line of lines) {
    const matchingItem = order.items?.find((item) => {
      if (line.rental_bundle_external_key) {
        return item.rentalBundle?.externalId === line.rental_bundle_external_key;
      }
      return item.rentalItem?.product?.sku === line.rental_item_sku;
    });
    if (!matchingItem) {
      throw new Error(`${row.order_id}: extension item not found for line ${line.line_no}`);
    }

    extensionItems.push({
      rentalOrderItemId: matchingItem.id,
      quantity: numberValue(line.qty),
      additionalAmount: extension.additionalAmount,
      notes: `source=${row.order_id}; historical extension amount from Pengiriman sheet`,
    });
  }

  await callTool(client, 'rental_order_extend', {
    companyId: COMPANY_ID,
    input: JSON.stringify({
      orderId: createdOrder.id,
      newEndDate: toBusinessIso(extension.newEndDate),
      items: extensionItems,
      deliveryFee: extension.deliveryFee,
      deliveryFeeLabel: extension.deliveryFeeLabel,
      reason: extension.reason,
      allowHistorical: true,
      updateOrderTotal: true,
      updateOrderDates: true,
      businessDate: toBusinessIso(row.rental_end_date),
      isPaid: false,
    }),
  });

  return callTool(client, 'rental_order_get', {
    companyId: COMPANY_ID,
    id: createdOrder.id,
  });
}

async function main() {
  const orderRows = parseCsv(fs.readFileSync(HEADER_CSV, 'utf8'));
  const lineRows = parseCsv(fs.readFileSync(LINE_CSV, 'utf8'));
  const { rows, errors } = validateRows(orderRows, lineRows);
  if (errors.length > 0) {
    throw new Error(`Preflight failed:\n- ${errors.join('\n- ')}`);
  }

  const targetTotal = rows.reduce((sum, row) => sum + finalTotalFor(row, lineRows), 0);
  if (rows.length !== BATCH.expectedCount) {
    throw new Error(`Expected ${BATCH.expectedCount} target rows, got ${rows.length}`);
  }
  if (targetTotal !== BATCH.expectedTotal) {
    throw new Error(`Expected target total ${BATCH.expectedTotal}, got ${targetTotal}`);
  }

  const client = new Client({ name: 'codex-santi-living-sheet-rental-import', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(MCP_URL)));

  const companies = toArray(await callTool(client, 'company_list', {}));
  const company = companies.find((item) => item.id === COMPANY_ID && item.name === COMPANY_NAME);
  if (!company) throw new Error(`Company ${COMPANY_NAME} (${COMPANY_ID}) not found`);

  const existingPartners = toArray(
    await callTool(client, 'partner_list', { companyId: COMPANY_ID, type: 'CUSTOMER' })
  );
  const existingOrders = toArray(
    await callTool(client, 'rental_order_list', { companyId: COMPANY_ID, take: 100 })
  );

  const duplicateRows = rows
    .map((row) => ({ row, existing: duplicateFor(row, existingOrders) }))
    .filter((item) => item.existing);
  const conflictingDuplicateRows = duplicateRows.filter(
    ({ row, existing }) => orderRefFromNotes(existing.notes) !== row.order_id
  );
  if (conflictingDuplicateRows.length > 0) {
    throw new Error(
      `Refusing to import possible duplicates:\n- ${conflictingDuplicateRows
        .map(({ row, existing }) => `${row.order_id} -> ${existing.orderNumber} ${existing.partner?.name}`)
        .join('\n- ')}`
    );
  }
  const alreadyImportedByOrderId = new Map(
    duplicateRows.map(({ row, existing }) => [row.order_id, existing])
  );

  const { rentalItemIdsBySku, bundleIdsByExternalId, bundleActions } = await ensureBundles(client, lineRows);

  const partnerIdsByNameAndAddress = new Map();
  for (const partner of existingPartners) {
    partnerIdsByNameAndAddress.set(`${partner.name}||${partner.address ?? ''}`, partner.id);
  }

  const results = [];
  for (const row of rows.sort((a, b) => a.rental_start_date.localeCompare(b.rental_start_date) || a.order_id.localeCompare(b.order_id))) {
    const existingOrder = alreadyImportedByOrderId.get(row.order_id);
    if (existingOrder) {
      results.push({
        order_id: row.order_id,
        action: 'exists',
        partner_action: 'reuse',
        order_id_created: existingOrder.id,
        order_number: existingOrder.orderNumber,
        total_amount: numberValue(existingOrder.totalAmount),
        status: existingOrder.status,
        message: 'Already exists with matching sheet_order_id; no duplicate created',
      });
      continue;
    }

    const name = partnerName(row);
    const partnerKey = `${name}||${row.delivery_address ?? ''}`;
    let partnerId = partnerIdsByNameAndAddress.get(partnerKey);
    let partnerAction = 'reuse';

    if (!partnerId) {
      if (APPLY) {
        const partner = await callTool(client, 'partner_create', {
          companyId: COMPANY_ID,
          name,
          type: 'CUSTOMER',
          address: row.delivery_address,
        });
        partnerId = partner.id;
        partnerIdsByNameAndAddress.set(partnerKey, partnerId);
        partnerAction = 'created';
      } else {
        partnerId = `dry-run-partner-${row.order_id}`;
        partnerAction = 'would_create';
      }
    }

    const lines = lineRows.filter((line) => line.order_id === row.order_id);
    const input = buildOrderInput(row, lines, bundleIdsByExternalId, rentalItemIdsBySku, partnerId);

    if (!APPLY) {
      results.push({
        order_id: row.order_id,
        action: 'would_create',
        partner_action: partnerAction,
        order_id_created: '',
        order_number: '',
        total_amount: finalTotalFor(row, lineRows),
        status: 'DRAFT',
        message: JSON.stringify(input),
      });
      continue;
    }

    const createdBaseOrder = await callTool(client, 'rental_order_create', {
      companyId: COMPANY_ID,
      input: JSON.stringify(input),
    });
    const created = await applyConfiguredExtension(client, row, lineRows, createdBaseOrder);
    results.push({
      order_id: row.order_id,
      action: 'created',
      partner_action: partnerAction,
      order_id_created: created.id,
      order_number: created.orderNumber,
      total_amount: numberValue(created.totalAmount),
      status: created.status,
      message: 'Created via sync-erp MCP with exact source lineTotal',
    });
    console.log(`created ${row.order_id} -> ${created.orderNumber} ${idr(created.totalAmount)}`);
  }

  const verification = {
    scopedCount: 0,
    scopedTotal: 0,
    missingOrderIds: [],
    duplicateOrderIds: [],
    statusCounts: {},
  };

  if (APPLY) {
    const readbackOrders = toArray(
      await callTool(client, 'rental_order_list', { companyId: COMPANY_ID, take: 100 })
    );
    const byOrderId = new Map();
    for (const order of readbackOrders) {
      const orderId = orderRefFromNotes(order.notes);
      if (!ORDER_IDS_TO_IMPORT.has(orderId)) continue;
      if (!byOrderId.has(orderId)) byOrderId.set(orderId, []);
      byOrderId.get(orderId).push(order);
    }
    for (const orderId of ORDER_IDS_TO_IMPORT) {
      const found = byOrderId.get(orderId) ?? [];
      if (found.length === 0) {
        verification.missingOrderIds.push(orderId);
        continue;
      }
      if (found.length > 1) verification.duplicateOrderIds.push(orderId);
      for (const order of found) {
        verification.scopedCount += 1;
        verification.scopedTotal += numberValue(order.totalAmount);
        verification.statusCounts[order.status] = (verification.statusCounts[order.status] ?? 0) + 1;
      }
    }

    const verifyErrors = [];
    if (verification.scopedCount !== BATCH.expectedCount) {
      verifyErrors.push(`readback scopedCount ${verification.scopedCount} != ${BATCH.expectedCount}`);
    }
    if (verification.scopedTotal !== BATCH.expectedTotal) {
      verifyErrors.push(`readback scopedTotal ${verification.scopedTotal} != ${BATCH.expectedTotal}`);
    }
    if (verification.missingOrderIds.length > 0) verifyErrors.push(`missing order IDs: ${verification.missingOrderIds.join(', ')}`);
    if (verification.duplicateOrderIds.length > 0) verifyErrors.push(`duplicate order IDs: ${verification.duplicateOrderIds.join(', ')}`);
    if (verifyErrors.length > 0) throw new Error(`Post-import verification failed:\n- ${verifyErrors.join('\n- ')}`);
  }

  const csvRows = [
    ['order_id', 'action', 'partner_action', 'order_id_created', 'order_number', 'total_amount', 'status', 'message'],
    ...results.map((row) => [
      row.order_id,
      row.action,
      row.partner_action,
      row.order_id_created,
      row.order_number,
      row.total_amount,
      row.status,
      row.message,
    ]),
  ];
  fs.writeFileSync(RESULT_CSV, csvRows.map((row) => row.map(csvEscape).join(',')).join('\n') + '\n');

  const md = `# Rental Sheet Import - ${BATCH.name} - 2026-05-28

Mode: ${APPLY ? 'apply' : 'dry-run'}
Company: ${COMPANY_NAME} (${COMPANY_ID})
Source folder: ${SOURCE_DIR}

## Scope
- Target order IDs: ${[...ORDER_IDS_TO_IMPORT].join(', ')}
- Target count: ${rows.length}
- Target total: ${idr(targetTotal)}
- Scope note: ${BATCH.scopeNote}
- Rows outside this batch were not mutated by this run.
- Existing likely matches and WhatsApp imports were not duplicated.

## Bundle Actions
${bundleActions.map((row) => `- ${row.externalId}: ${row.action}${row.id ? ` (${row.id})` : ''}`).join('\n')}

## Orders
- Created: ${results.filter((row) => row.action === 'created').length}
- Would create: ${results.filter((row) => row.action === 'would_create').length}
- Existing/reused: ${results.filter((row) => row.action === 'exists').length}
- Target exact total: ${idr(targetTotal)}

## Verification
- Readback scoped count: ${verification.scopedCount}
- Readback scoped total: ${idr(verification.scopedTotal)}
- Missing order IDs: ${verification.missingOrderIds.join(', ') || '-'}
- Duplicate order IDs: ${verification.duplicateOrderIds.join(', ') || '-'}
- Status counts: ${JSON.stringify(verification.statusCounts)}

## Notes
- Orders are created as DRAFT/PENDING only; no payment settlement was posted in this step.
- Every imported line uses source CSV lineTotal so historical package prices are preserved.
- Net delivery fee is posted to deliveryFee; billed delivery fee and delivery discount are retained in notes.
`;
  fs.writeFileSync(RESULT_MD, md);

  await client.close();
  console.log(
    JSON.stringify(
      {
        mode: APPLY ? 'apply' : 'dry-run',
        batch: BATCH.name,
        targetCount: rows.length,
        targetTotal,
        created: results.filter((row) => row.action === 'created').length,
        wouldCreate: results.filter((row) => row.action === 'would_create').length,
        exists: results.filter((row) => row.action === 'exists').length,
        verification,
        resultCsv: RESULT_CSV,
        resultMd: RESULT_MD,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
