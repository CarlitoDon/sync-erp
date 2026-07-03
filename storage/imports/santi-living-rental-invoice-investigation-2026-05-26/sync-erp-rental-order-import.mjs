import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const COMPANY_ID = 'f023d223-f787-4007-9660-1bfa155c6ec4';
const COMPANY_NAME = 'Santi Living';
const MCP_URL = 'http://127.0.0.1:3005/mcp';
const APPLY = process.argv.includes('--apply');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORDER_CANDIDATES = path.join(__dirname, 'rental-order-import-candidates.csv');
const LINE_CANDIDATES = path.join(__dirname, 'rental-order-line-import-candidates.csv');
const RESULT_CSV = path.join(__dirname, 'sync-erp-rental-order-import-result-2026-05-26.csv');
const RESULT_MD = path.join(__dirname, 'sync-erp-rental-order-import-result-2026-05-26.md');

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
    description: 'Revenue-only add-on from WhatsApp invoice; source invoice does not identify pillow brand.',
    components: [],
  },
  {
    externalId: 'ADDON-SELIMUT-UNTRACKED',
    name: 'Add on Selimut (Untracked)',
    shortName: 'Selimut',
    dailyRate: 10000,
    weeklyRate: 60000,
    monthlyRate: 250000,
    description: 'Revenue-only add-on from WhatsApp invoice.',
    components: [],
  },
  {
    externalId: 'ADDON-SPREI-UNTRACKED',
    name: 'Add on Sprei (Untracked)',
    shortName: 'Sprei',
    dailyRate: 10000,
    weeklyRate: 60000,
    monthlyRate: 250000,
    description: 'Revenue-only add-on from WhatsApp invoice.',
    components: [],
  },
  {
    externalId: 'ADDON-KIPAS-UNTRACKED',
    name: 'Kipas Angin (Untracked)',
    shortName: 'Kipas',
    dailyRate: 20000,
    weeklyRate: 120000,
    monthlyRate: 500000,
    description: 'Revenue-only add-on from WhatsApp invoice; invoice line price remains authoritative.',
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
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      row.push(cell);
      if (row.some((value) => value !== '')) {
        rows.push(row);
      }
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value !== '')) {
      rows.push(row);
    }
  }

  const [headers, ...records] = rows;
  return records.map((record) =>
    Object.fromEntries(headers.map((header, index) => [header, record[index] ?? '']))
  );
}

function readCsv(filePath) {
  return parseCsv(fs.readFileSync(filePath, 'utf8'));
}

function numberValue(value) {
  if (value === undefined || value === null || value === '') {
    return 0;
  }
  return Number(String(value).replace(/[^\d.-]/g, ''));
}

function idr(value) {
  return `Rp${Number(value).toLocaleString('id-ID')}`;
}

function csvEscape(value) {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toUtcIso(value) {
  return new Date(value).toISOString();
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

function invoiceRefFromNotes(notes) {
  const match = String(notes ?? '').match(/invoice_ref=(SL-INV-\d+)/);
  return match?.[1] ?? null;
}

function validateCandidates(orderRows, lineRows) {
  const postable = orderRows.filter((row) => row.action === 'post_draft_order');
  const held = orderRows.filter((row) => row.action !== 'post_draft_order');
  const refs = new Set();
  const errors = [];

  for (const row of postable) {
    if (refs.has(row.invoice_ref)) errors.push(`Duplicate candidate invoice_ref ${row.invoice_ref}`);
    refs.add(row.invoice_ref);
    if (!row.partner_id) errors.push(`${row.invoice_ref} has no partner_id`);

    let input;
    try {
      input = JSON.parse(row.mcp_input_json);
    } catch (error) {
      errors.push(`${row.invoice_ref} has invalid mcp_input_json: ${error.message}`);
      continue;
    }

    const duration = numberValue(row.duration_nights);
    const lineSubtotal = input.items.reduce(
      (sum, item) => sum + numberValue(item.quantity) * numberValue(item.pricePerDay) * duration,
      0
    );
    const delivery = numberValue(input.deliveryFee);
    const discount = numberValue(input.discountAmount);
    const expected = lineSubtotal + delivery - discount;
    const total = numberValue(row.total_idr);

    if (expected !== total) {
      errors.push(
        `${row.invoice_ref} total mismatch: lines ${lineSubtotal} + delivery ${delivery} - discount ${discount} = ${expected}, source total ${total}`
      );
    }

    for (const [index, item] of input.items.entries()) {
      if (!item.rentalBundleExternalKey && !item.rentalItemSku) {
        errors.push(`${row.invoice_ref} line ${index + 1} has no rental bundle key or item sku`);
      }
      if (!item.pricePerDay) {
        errors.push(`${row.invoice_ref} line ${index + 1} has no pricePerDay`);
      }
    }

    if (row.invoice_ref === 'SL-INV-009') {
      if (numberValue(input.deliveryFee) !== 55000 || input.discountAmount !== undefined) {
        errors.push('SL-INV-009 must use net deliveryFee 55000 and no discountAmount');
      }
    }
  }

  const postableLineRefs = new Set(
    lineRows.filter((row) => row.action === 'post_draft_order').map((row) => row.invoice_ref)
  );
  for (const ref of refs) {
    if (!postableLineRefs.has(ref)) errors.push(`${ref} has no postable detail lines`);
  }

  const postableTotal = postable.reduce((sum, row) => sum + numberValue(row.total_idr), 0);
  if (postable.length !== 26) errors.push(`Expected 26 postable invoices, got ${postable.length}`);
  if (postableTotal !== 8811000) errors.push(`Expected postable total 8811000, got ${postableTotal}`);

  return { postable, held, postableTotal, errors };
}

function buildOrderInput(row, bundleIdsByExternalId, rentalItemIdsBySku) {
  const source = JSON.parse(row.mcp_input_json);
  const input = {
    partnerId: row.partner_id,
    rentalStartDate: toUtcIso(source.rentalStartDate),
    rentalEndDate: toUtcIso(source.rentalEndDate),
    dueDateTime: toUtcIso(source.dueDateTime),
    notes: `${source.notes ?? ''}\nimport_method=codex_direct_mcp\nimport_batch=santi-living-rental-invoice-investigation-2026-05-26`,
    deliveryFee: numberValue(source.deliveryFee),
    deliveryAddress: source.deliveryAddress,
    paymentMethod: source.paymentMethod,
    items: source.items.map((item) => {
      const output = {
        quantity: numberValue(item.quantity),
        pricePerDay: numberValue(item.pricePerDay),
      };
      if (item.rentalBundleExternalKey) {
        const bundleId = bundleIdsByExternalId.get(item.rentalBundleExternalKey);
        if (!bundleId) throw new Error(`${row.invoice_ref}: missing bundle ${item.rentalBundleExternalKey}`);
        output.rentalBundleId = bundleId;
      } else if (item.rentalItemSku) {
        const rentalItemId = rentalItemIdsBySku.get(item.rentalItemSku);
        if (!rentalItemId) throw new Error(`${row.invoice_ref}: missing rental item ${item.rentalItemSku}`);
        output.rentalItemId = rentalItemId;
      }
      return output;
    }),
  };

  if (numberValue(source.discountAmount) > 0) {
    input.discountAmount = numberValue(source.discountAmount);
  }
  if (source.discountLabel) {
    input.discountLabel = source.discountLabel;
  }

  return input;
}

function sortPostable(rows) {
  return [...rows].sort((a, b) => {
    const byStart = a.rental_start_date.localeCompare(b.rental_start_date);
    return byStart || a.invoice_ref.localeCompare(b.invoice_ref);
  });
}

async function main() {
  const orderRows = readCsv(ORDER_CANDIDATES);
  const lineRows = readCsv(LINE_CANDIDATES);
  const { postable, held, postableTotal, errors } = validateCandidates(orderRows, lineRows);

  if (errors.length > 0) {
    throw new Error(`Preflight failed:\n- ${errors.join('\n- ')}`);
  }

  const client = new Client({ name: 'codex-santi-living-rental-import', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(MCP_URL)));

  const companies = toArray(await callTool(client, 'company_list', {}));
  const company = companies.find((item) => item.id === COMPANY_ID && item.name === COMPANY_NAME);
  if (!company) throw new Error(`Company ${COMPANY_NAME} (${COMPANY_ID}) not found`);

  const existingOrders = toArray(await callTool(client, 'rental_order_list', { companyId: COMPANY_ID }));
  const existingByRef = new Map();
  for (const order of existingOrders) {
    const ref = invoiceRefFromNotes(order.notes);
    if (ref) {
      if (!existingByRef.has(ref)) existingByRef.set(ref, []);
      existingByRef.get(ref).push(order);
    }
  }

  const duplicateExisting = [...existingByRef.entries()].filter(([, orders]) => orders.length > 1);
  if (duplicateExisting.length > 0) {
    throw new Error(
      `Existing duplicate invoice refs: ${duplicateExisting
        .map(([ref, orders]) => `${ref} (${orders.length})`)
        .join(', ')}`
    );
  }

  const rentalItems = toArray(await callTool(client, 'rental_item_list', { companyId: COMPANY_ID }));
  const rentalItemIdsBySku = new Map();
  for (const item of rentalItems) {
    if (item.product?.sku) rentalItemIdsBySku.set(item.product.sku, item.id);
  }

  const requiredSkus = new Set();
  for (const def of BUNDLE_DEFS) {
    for (const component of def.components) requiredSkus.add(component.sku);
  }
  for (const row of postable) {
    const input = JSON.parse(row.mcp_input_json);
    for (const item of input.items) {
      if (item.rentalItemSku) requiredSkus.add(item.rentalItemSku);
    }
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

  const bundleActions = [];
  for (const def of BUNDLE_DEFS) {
    if (bundleIdsByExternalId.has(def.externalId)) {
      bundleActions.push({ externalId: def.externalId, action: 'reuse', id: bundleIdsByExternalId.get(def.externalId) });
      continue;
    }
    if (!APPLY) {
      bundleActions.push({ externalId: def.externalId, action: 'would_create', id: '' });
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

  if (APPLY) {
    bundles = toArray(await callTool(client, 'rental_bundle_list', { companyId: COMPANY_ID }));
    for (const bundle of bundles) {
      if (bundle.externalId) bundleIdsByExternalId.set(bundle.externalId, bundle.id);
      const matchingDef = BUNDLE_DEFS.find((def) => def.name === bundle.name);
      if (matchingDef) bundleIdsByExternalId.set(matchingDef.externalId, bundle.id);
    }
  } else {
    for (const def of BUNDLE_DEFS) {
      if (!bundleIdsByExternalId.has(def.externalId)) {
        bundleIdsByExternalId.set(def.externalId, `dry-run-${def.externalId}`);
      }
    }
  }

  const orderResults = [];
  for (const row of sortPostable(postable)) {
    const existing = existingByRef.get(row.invoice_ref)?.[0];
    if (existing) {
      orderResults.push({
        invoice_ref: row.invoice_ref,
        action: 'skip_existing',
        order_id: existing.id,
        order_number: existing.orderNumber,
        total_amount: existing.totalAmount,
        status: existing.status,
        message: 'Existing rental order has matching invoice_ref in notes',
      });
      continue;
    }

    const input = buildOrderInput(row, bundleIdsByExternalId, rentalItemIdsBySku);
    if (!APPLY) {
      orderResults.push({
        invoice_ref: row.invoice_ref,
        action: 'would_create',
        order_id: '',
        order_number: '',
        total_amount: row.total_idr,
        status: 'DRAFT',
        message: JSON.stringify(input),
      });
      continue;
    }

    const created = await callTool(client, 'rental_order_create', {
      companyId: COMPANY_ID,
      input: JSON.stringify(input),
    });
    orderResults.push({
      invoice_ref: row.invoice_ref,
      action: 'created',
      order_id: created.id,
      order_number: created.orderNumber,
      total_amount: created.totalAmount,
      status: created.status,
      message: 'Created via sync-erp MCP',
    });
    console.log(`created ${row.invoice_ref} -> ${created.orderNumber} ${idr(created.totalAmount)}`);
  }

  let verification = {
    order_count: 0,
    total_amount: 0,
    missing_refs: [],
    duplicate_refs: [],
    status_counts: {},
  };

  if (APPLY) {
    const readbackOrders = toArray(await callTool(client, 'rental_order_list', { companyId: COMPANY_ID }));
    const postableRefs = new Set(postable.map((row) => row.invoice_ref));
    const scoped = readbackOrders.filter((order) => postableRefs.has(invoiceRefFromNotes(order.notes)));
    const byRef = new Map();
    for (const order of scoped) {
      const ref = invoiceRefFromNotes(order.notes);
      if (!byRef.has(ref)) byRef.set(ref, []);
      byRef.get(ref).push(order);
      verification.total_amount += numberValue(order.totalAmount);
      verification.status_counts[order.status] = (verification.status_counts[order.status] ?? 0) + 1;
    }
    verification.order_count = scoped.length;
    verification.missing_refs = [...postableRefs].filter((ref) => !byRef.has(ref));
    verification.duplicate_refs = [...byRef.entries()]
      .filter(([, orders]) => orders.length > 1)
      .map(([ref]) => ref);

    const verifyErrors = [];
    if (verification.order_count !== 26) verifyErrors.push(`readback order_count ${verification.order_count} != 26`);
    if (verification.total_amount !== 8811000) {
      verifyErrors.push(`readback total ${verification.total_amount} != 8811000`);
    }
    if (verification.missing_refs.length > 0) verifyErrors.push(`missing refs: ${verification.missing_refs.join(', ')}`);
    if (verification.duplicate_refs.length > 0) {
      verifyErrors.push(`duplicate refs: ${verification.duplicate_refs.join(', ')}`);
    }
    if (verifyErrors.length > 0) {
      throw new Error(`Post-import verification failed:\n- ${verifyErrors.join('\n- ')}`);
    }
  }

  const resultRows = [
    ['invoice_ref', 'action', 'order_id', 'order_number', 'total_amount', 'status', 'message'],
    ...orderResults.map((row) => [
      row.invoice_ref,
      row.action,
      row.order_id,
      row.order_number,
      row.total_amount,
      row.status,
      row.message,
    ]),
  ];
  fs.writeFileSync(RESULT_CSV, resultRows.map((row) => row.map(csvEscape).join(',')).join('\n') + '\n');

  const bundleLines = bundleActions
    .map((row) => `- ${row.externalId}: ${row.action}${row.id ? ` (${row.id})` : ''}`)
    .join('\n');
  const md = `# Sync ERP Rental Order Import Result - 2026-05-26

Mode: ${APPLY ? 'apply' : 'dry-run'}
Company: ${COMPANY_NAME} (${COMPANY_ID})
Source folder: ${__dirname}

## Input Validation
- Postable invoices: ${postable.length}
- Held invoices: ${held.length}
- Postable source total: ${idr(postableTotal)}
- Calculation mismatches: 0
- Missing postable partners: 0
- Variable ongkir policy: every invoice uses its own net deliveryFee from WhatsApp evidence.
- SL-INV-009: deliveryFee ${idr(55000)}, discountAmount omitted because the Rp15.000 discount is already netted into ongkir.

## Bundles
${bundleLines}

## Orders
- Created: ${orderResults.filter((row) => row.action === 'created').length}
- Reused/skipped existing: ${orderResults.filter((row) => row.action === 'skip_existing').length}
- Would create: ${orderResults.filter((row) => row.action === 'would_create').length}

## Verification
- Readback order count: ${verification.order_count}
- Readback total: ${idr(verification.total_amount)}
- Missing refs: ${verification.missing_refs.join(', ') || '-'}
- Duplicate refs: ${verification.duplicate_refs.join(', ') || '-'}
- Status counts: ${JSON.stringify(verification.status_counts)}

## Notes
- Orders are imported as DRAFT rental orders only. No confirmation, release, return, or payment verification was performed.
- Package and kasur-only prices are invoice-specific through line pricePerDay.
- Add-on bundles marked Untracked preserve invoice revenue without inferring unspecified stock brand from WhatsApp text.
`;
  fs.writeFileSync(RESULT_MD, md);

  await client.close();

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? 'apply' : 'dry-run',
        postable: postable.length,
        postableTotal,
        bundleActions,
        created: orderResults.filter((row) => row.action === 'created').length,
        skippedExisting: orderResults.filter((row) => row.action === 'skip_existing').length,
        wouldCreate: orderResults.filter((row) => row.action === 'would_create').length,
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
