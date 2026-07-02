/**
 * Attachment Tools
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ToolSpec } from '../types.js';
import { apiMutation, apiQuery } from '../client.js';
import {
  buildInput,
  companyIdProp,
  getOptionalString,
  getString,
  idProp,
} from './_helpers.js';

const entityTypeProp = {
  type: 'string',
  enum: [
    'BILL',
    'INVOICE',
    'PURCHASE_ORDER',
    'SALES_ORDER',
    'GOODS_RECEIPT',
    'SHIPMENT',
    'PAYMENT',
    'EXPENSE',
    'RENTAL_ORDER',
    'RENTAL_ITEM',
    'PRODUCT',
    'PARTNER',
  ],
  description: 'Record type to attach the file to',
} as const;

export function getAttachmentTools(): ToolSpec[] {
  return [
    {
      name: 'attachment_list',
      description: 'List attachments for a Sync ERP record',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          entityType: entityTypeProp,
          entityId: idProp,
        },
        required: ['companyId', 'entityType', 'entityId'],
      },
      handler: async (args) =>
        apiQuery(
          'attachment.list',
          {
            entityType: getString(args, 'entityType'),
            entityId: getString(args, 'entityId'),
          },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'attachment_get',
      description: 'Get attachment metadata by ID',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiQuery(
          'attachment.get',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
    {
      name: 'attachment_upload',
      description:
        'Attach a local file to a Sync ERP record. The MCP process reads filePath and stores a local copy in Sync ERP storage.',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: companyIdProp,
          entityType: entityTypeProp,
          entityId: idProp,
          filePath: {
            type: 'string',
            description: 'Absolute or workspace-relative local file path',
          },
          fileName: {
            type: 'string',
            description: 'Optional display filename',
          },
          mimeType: {
            type: 'string',
            description: 'Optional MIME type',
          },
          notes: { type: 'string' },
        },
        required: ['companyId', 'entityType', 'entityId', 'filePath'],
      },
      handler: async (args) => {
        const filePath = getString(args, 'filePath');
        const buffer = await readFile(filePath);
        const fileName =
          getOptionalString(args, 'fileName') || path.basename(filePath);

        return apiMutation(
          'attachment.upload',
          buildInput([
            ['entityType', getString(args, 'entityType')],
            ['entityId', getString(args, 'entityId')],
            ['fileName', fileName],
            [
              'mimeType',
              getOptionalString(args, 'mimeType') || inferMimeType(fileName),
            ],
            ['fileBase64', buffer.toString('base64')],
            ['notes', getOptionalString(args, 'notes')],
          ]),
          getString(args, 'companyId')
        );
      },
    },
    {
      name: 'attachment_delete',
      description: 'Delete an attachment metadata row and its local file',
      inputSchema: {
        type: 'object',
        properties: { companyId: companyIdProp, id: idProp },
        required: ['companyId', 'id'],
      },
      handler: async (args) =>
        apiMutation(
          'attachment.delete',
          { id: getString(args, 'id') },
          getString(args, 'companyId')
        ),
    },
  ];
}

function inferMimeType(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  switch (extension) {
    case '.pdf':
      return 'application/pdf';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.csv':
      return 'text/csv';
    case '.txt':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
}
