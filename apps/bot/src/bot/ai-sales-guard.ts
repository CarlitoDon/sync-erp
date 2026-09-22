/**
 * AI Sales Guard
 * Checks whether AI Sales is enabled or if an emergency cut has been triggered via tRPC.
 */

import { z } from 'zod';
import { trpc } from '../lib/trpc';

const aiSalesStatusSchema = z.object({
  aiSalesEnabled: z.boolean(),
  emergencyCut: z.boolean(),
});

function isProcedureWithQuery(
  val: unknown,
): val is { query: () => Promise<unknown> } {
  if (typeof val !== 'object' || val === null) return false;
  return 'query' in val && typeof (val as Record<string, unknown>).query === 'function';
}

let cachedAiSalesEnabled = true;

export async function checkAiSalesEnabled(): Promise<boolean> {
  try {
    const rawBot: unknown = trpc.bot;
    if (typeof rawBot === 'object' && rawBot !== null && 'getAiSalesStatus' in rawBot) {
      const candidate: unknown = (rawBot as Record<string, unknown>).getAiSalesStatus;
      if (isProcedureWithQuery(candidate)) {
        const rawRes: unknown = await candidate.query();
        const parsed = aiSalesStatusSchema.safeParse(rawRes);
        if (parsed.success) {
          cachedAiSalesEnabled = parsed.data.aiSalesEnabled;
        }
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[ai-sales-guard] Failed to fetch aiSalesEnabled via tRPC, using cached state:',
      err instanceof Error ? err.message : String(err),
    );
  }
  return cachedAiSalesEnabled;
}
