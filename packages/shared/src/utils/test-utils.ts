import type { MockInstance } from 'vitest';
import type { Request, Response } from 'express';


/**
 * Type-safe casting utilities for test boundaries.
 * Enforces `unknown -> Type` validation flow per Meridian standards,
 * avoiding raw `any` inside test files.
 */

// Safely cast Prisma deeply mocked functions to Vitest MockInstances
export function asMock(fn: unknown): MockInstance {
  return fn as unknown as MockInstance;
}

// Safely provide partial mock implementations for complex domain data
export function asPartial<T>(obj: unknown): T {
  return obj as unknown as T;
}

// Safely inject partial Express objects
export function asRequest(obj: unknown): Request {
  return obj as unknown as Request;
}

export function asResponse(obj: unknown): Response {
  return obj as unknown as Response;
}

// Safely extract loosely-bound global properties
export function getTestGlobal<T>(key: string): T | undefined {
  return (globalThis as unknown as Record<string, T>)[key];
}

export function asJournalLine(obj: unknown): { account?: { code: string }; debit?: string | number; credit?: string | number } {
  return obj as unknown as { account?: { code: string }; debit?: string | number; credit?: string | number };
}
