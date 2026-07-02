/**
 * Company Tools
 */
import type { ToolSpec } from '../types.js';
import { apiMutation, apiQuery } from '../client.js';
import { getOptionalString, getString } from './_helpers.js';

const BUSINESS_SHAPES = [
  'RETAIL',
  'MANUFACTURING',
  'SERVICE',
  'RENTAL',
] as const;

type BusinessShape = (typeof BUSINESS_SHAPES)[number];

function isBusinessShape(value: string): value is BusinessShape {
  return (BUSINESS_SHAPES as readonly string[]).includes(value);
}

function getOptionalShape(
  args: Record<string, unknown>
): BusinessShape | undefined {
  const shape =
    getOptionalString(args, 'shape') ??
    getOptionalString(args, 'businessShape');

  if (shape === undefined) {
    return undefined;
  }

  const normalized = shape.toUpperCase();
  if (!isBusinessShape(normalized)) {
    throw new Error(
      `Invalid business shape: ${shape}. Must be one of: ${BUSINESS_SHAPES.join(', ')}`
    );
  }

  return normalized;
}

function getShape(args: Record<string, unknown>, key: string): BusinessShape {
  const shape = getString(args, key);
  const normalized = shape.toUpperCase();

  if (!isBusinessShape(normalized)) {
    throw new Error(
      `Invalid business shape: ${shape}. Must be one of: ${BUSINESS_SHAPES.join(', ')}`
    );
  }

  return normalized;
}

function parseCreatedCompanyId(payload: string): string {
  const parsed: unknown = JSON.parse(payload);
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    typeof (parsed as Record<string, unknown>).id === 'string'
  ) {
    return (parsed as Record<string, string>).id;
  }

  throw new Error('Company created but response did not include an id');
}

export function getCompanyTools(): ToolSpec[] {
  return [
    {
      name: 'company_list',
      description: 'List all companies the authenticated user belongs to',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => apiQuery('company.list'),
    },
    {
      name: 'company_get',
      description: 'Get company details by ID',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Company UUID' },
        },
        required: ['id'],
      },
      handler: async (args) =>
        apiQuery('company.getById', { id: getString(args, 'id') }),
    },
    {
      name: 'company_create',
      description:
        'Create a new company for the authenticated user. Optionally select a business shape in the same call.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Company name' },
          shape: {
            type: 'string',
            enum: BUSINESS_SHAPES,
            description:
              'Optional business shape to activate after creation',
          },
          businessShape: {
            type: 'string',
            enum: BUSINESS_SHAPES,
            description:
              'Optional alias for shape; use one of RETAIL, MANUFACTURING, SERVICE, RENTAL',
          },
        },
        required: ['name'],
      },
      handler: async (args) => {
        const created = await apiMutation('company.create', {
          name: getString(args, 'name'),
        });
        const shape = getOptionalShape(args);

        if (!shape) {
          return created;
        }

        const companyId = parseCreatedCompanyId(created);
        return apiMutation('company.selectShape', {
          companyId,
          shape,
        });
      },
    },
    {
      name: 'company_select_shape',
      description:
        'Select the business shape for a company once after creation',
      inputSchema: {
        type: 'object',
        properties: {
          companyId: { type: 'string', description: 'Company UUID' },
          shape: {
            type: 'string',
            enum: BUSINESS_SHAPES,
            description: 'Business shape to activate',
          },
        },
        required: ['companyId', 'shape'],
      },
      handler: async (args) =>
        apiMutation('company.selectShape', {
          companyId: getString(args, 'companyId'),
          shape: getShape(args, 'shape'),
        }),
    },
  ];
}
