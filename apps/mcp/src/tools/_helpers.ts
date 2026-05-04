/**
 * Shared helpers for tool definitions.
 */
import type { JsonSchemaProperty } from '../types.js';

/** Standard companyId property for JSON Schema */
export const companyIdProp: JsonSchemaProperty = {
  type: 'string',
  description: 'Company UUID',
  format: 'uuid',
} as const;

/** Standard UUID ID property */
export const idProp: JsonSchemaProperty = {
  type: 'string',
  description: 'Record UUID',
  format: 'uuid',
} as const;

/** Standard optional status filter */
export const statusFilterProp: JsonSchemaProperty = {
  type: 'string',
  description: 'Filter by status',
} as const;

/**
 * Safely extract a string from unknown args record.
 */
export function getString(
  args: Record<string, unknown>,
  key: string
): string {
  const val = args[key];
  if (typeof val !== 'string') {
    throw new Error(`Missing or invalid required parameter: ${key}`);
  }
  return val;
}

/**
 * Safely extract an optional string.
 */
export function getOptionalString(
  args: Record<string, unknown>,
  key: string
): string | undefined {
  const val = args[key];
  if (val === undefined || val === null) return undefined;
  if (typeof val !== 'string') {
    throw new Error(`Parameter ${key} must be a string`);
  }
  return val;
}

/**
 * Safely extract an optional number.
 */
export function getOptionalNumber(
  args: Record<string, unknown>,
  key: string
): number | undefined {
  const val = args[key];
  if (val === undefined || val === null) return undefined;
  if (typeof val !== 'number') {
    throw new Error(`Parameter ${key} must be a number`);
  }
  return val;
}

/**
 * Safely extract a boolean.
 */
export function getOptionalBoolean(
  args: Record<string, unknown>,
  key: string
): boolean | undefined {
  const val = args[key];
  if (val === undefined || val === null) return undefined;
  if (typeof val !== 'boolean') {
    throw new Error(`Parameter ${key} must be a boolean`);
  }
  return val;
}

/**
 * Build a filtered input object, removing undefined values.
 */
export function buildInput(
  entries: Array<[string, unknown]>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}
