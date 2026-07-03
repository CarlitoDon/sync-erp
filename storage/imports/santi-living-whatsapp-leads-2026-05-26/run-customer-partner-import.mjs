import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import fs from 'node:fs';
import path from 'node:path';

const baseDir = path.dirname(new URL(import.meta.url).pathname);
const inputPath = path.join(baseDir, 'sync-erp-customer-partner-import-closing-only.csv');
const resultPath = path.join(baseDir, 'sync-erp-customer-partner-import-result.csv');
const summaryPath = path.join(baseDir, 'sync-erp-customer-partner-import-summary.md');
const mcpUrl = process.env.SYNC_ERP_MCP_URL ?? 'http://127.0.0.1:3005/mcp';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const [headers, ...dataRows] = rows;
  return dataRows
    .filter((dataRow) => dataRow.some((value) => value !== ''))
    .map((dataRow) =>
      Object.fromEntries(headers.map((header, index) => [header, dataRow[index] ?? '']))
    );
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function stringifyCsv(rows, fields) {
  return [
    fields.join(','),
    ...rows.map((row) => fields.map((field) => csvEscape(row[field])).join(',')),
  ].join('\n') + '\n';
}

function normalizePhone(value) {
  return String(value ?? '').replace(/\D/g, '').replace(/^0+/, '');
}

function textContent(response) {
  const textPart = response.content?.find((part) => part.type === 'text');
  return textPart?.text ?? '';
}

async function callJsonTool(client, name, args) {
  const response = await client.callTool({ name, arguments: args });
  const text = textContent(response);
  return text ? JSON.parse(text) : null;
}

const rows = parseCsv(fs.readFileSync(inputPath, 'utf8'));
if (rows.length !== 54) {
  throw new Error(`Expected 54 closing/customer rows, got ${rows.length}`);
}

const client = new Client({ name: 'santi-living-partner-import', version: '1.0.0' });
await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl)));

const results = [];
try {
  const companies = await callJsonTool(client, 'company_list', {});
  const company = companies.find((candidate) => candidate.name === 'Santi Living');
  if (!company) {
    throw new Error('Company Santi Living not found');
  }

  const beforePartners = await callJsonTool(client, 'partner_list', {
    companyId: company.id,
    type: 'CUSTOMER',
  });
  const existingByPhone = new Map(
    beforePartners
      .filter((partner) => partner.phone)
      .map((partner) => [normalizePhone(partner.phone), partner])
  );

  for (const [index, row] of rows.entries()) {
    const normalizedPhone = normalizePhone(row.phone || row.normalized_phone);
    const existing = existingByPhone.get(normalizedPhone);

    if (existing) {
      results.push({
        row_num: row.row_num,
        phone: row.phone,
        name: row.name,
        action: 'skipped_existing',
        partner_id: existing.id,
        status: 'ok',
        error: '',
      });
      continue;
    }

    try {
      const partner = await callJsonTool(client, 'partner_create', {
        companyId: company.id,
        name: row.name,
        type: 'CUSTOMER',
        phone: row.phone,
      });

      existingByPhone.set(normalizedPhone, partner);
      results.push({
        row_num: row.row_num,
        phone: row.phone,
        name: row.name,
        action: 'created',
        partner_id: partner.id,
        status: 'ok',
        error: '',
      });
    } catch (error) {
      results.push({
        row_num: row.row_num,
        phone: row.phone,
        name: row.name,
        action: 'create_failed',
        partner_id: '',
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    if ((index + 1) % 10 === 0 || index + 1 === rows.length) {
      console.log(`progress ${index + 1}/${rows.length}`);
    }
  }

  const afterPartners = await callJsonTool(client, 'partner_list', {
    companyId: company.id,
    type: 'CUSTOMER',
  });

  const resultFields = ['row_num', 'phone', 'name', 'action', 'partner_id', 'status', 'error'];
  fs.writeFileSync(resultPath, stringifyCsv(results, resultFields));

  const createdCount = results.filter((row) => row.action === 'created').length;
  const skippedCount = results.filter((row) => row.action === 'skipped_existing').length;
  const errorCount = results.filter((row) => row.status === 'error').length;
  const duplicatePhones = [...new Set(afterPartners.map((partner) => normalizePhone(partner.phone)).filter(Boolean))]
    .filter((phone) => afterPartners.filter((partner) => normalizePhone(partner.phone) === phone).length > 1);

  const summary = [
    '# Santi Living Customer Partner Import Summary',
    '',
    `Generated: 2026-05-26`,
    `Company: ${company.name} (${company.id})`,
    `MCP URL: ${mcpUrl}`,
    '',
    '## Counts',
    '',
    `- Source rows: ${rows.length}`,
    `- Created: ${createdCount}`,
    `- Skipped existing: ${skippedCount}`,
    `- Errors: ${errorCount}`,
    `- Customer partners after import: ${afterPartners.length}`,
    `- Duplicate normalized phones after import: ${duplicatePhones.length}`,
    '',
    '## Policy',
    '',
    '- Imported only WhatsApp closing/customer rows as `Partner CUSTOMER`.',
    '- Lead/open rows were intentionally not imported to Sync ERP.',
    '- Lead/open rows are tracked in Obsidian note: `10-Projects/Santi-Living/Santi Living WhatsApp Lead Backlog - 2026-05-26.md`.',
    '',
    '## Result File',
    '',
    `- \`${path.basename(resultPath)}\``,
    '',
  ].join('\n');
  fs.writeFileSync(summaryPath, summary);

  console.log(JSON.stringify({
    ok: errorCount === 0 && duplicatePhones.length === 0 && afterPartners.length >= rows.length,
    companyId: company.id,
    sourceRows: rows.length,
    created: createdCount,
    skippedExisting: skippedCount,
    errors: errorCount,
    customerPartnersAfter: afterPartners.length,
    duplicateNormalizedPhones: duplicatePhones.length,
    resultPath,
    summaryPath,
  }, null, 2));
} finally {
  await client.close();
}
