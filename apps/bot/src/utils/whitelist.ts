/**
 * Customer whitelist utilities for AI Sales testing.
 * Restricts inbound and outbound messages strictly to configured numbers (e.g. wife-only).
 *
 * Storage is now Redis-backed (dynamic) via Set `whatsapp:allowed_phones`.
 * On startup, `apps/bot/src/index.ts` seeds phones from ALLOWED_CUSTOMER_PHONES into Redis.
 */
import { getRedisClient } from '../bot/use-redis-auth-state.js';

const WHITELIST_KEY = 'whatsapp:allowed_phones';

/**
 * Normalizes phone number into international digit format without '+' or spaces.
 * E.g., '08123456789' -> '628123456789', '+62 812-3456-789' -> '628123456789'
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  return digits;
}

/**
 * Parses the ALLOWED_CUSTOMER_PHONES environment variable into a Set of normalized phone strings.
 * Used only for startup seeding — runtime lookups go to Redis.
 */
export function getAllowedCustomerPhones(): Set<string> {
  const envVal = process.env.ALLOWED_CUSTOMER_PHONES;
  if (!envVal || !envVal.trim()) {
    return new Set<string>();
  }
  return new Set(
    envVal
      .split(',')
      .map((p) => normalizePhone(p.trim()))
      .filter((p) => p.length > 0)
  );
}

/**
 * Checks whether a customer phone number is permitted.
 * Reads from Redis Set `whatsapp:allowed_phones`.
 * Fail-closed: If the set is empty or Redis errors, returns false.
 */
export async function isCustomerAllowed(phone: string): Promise<boolean> {
  const clean = normalizePhone(phone);
  try {
    const redis = getRedisClient();
    const isMember = await redis.sismember(WHITELIST_KEY, clean);
    return isMember === 1;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[whitelist] Redis error checking isCustomerAllowed:',
      err instanceof Error ? err.message : String(err)
    );
    return false;
  }
}

/**
 * Seeds ALLOWED_CUSTOMER_PHONES env var into Redis whitelist on startup.
 * Uses SADD so it does NOT wipe existing entries.
 */
export async function seedWhitelistFromEnv(): Promise<void> {
  const phones = getAllowedCustomerPhones();
  if (phones.size === 0) return;

  try {
    const redis = getRedisClient();
    await redis.sadd(WHITELIST_KEY, ...phones);
    // eslint-disable-next-line no-console
    console.log(
      `[whitelist] Seeded ${phones.size} phone(s) into Redis whitelist from ALLOWED_CUSTOMER_PHONES.`
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[whitelist] Failed to seed whitelist into Redis:',
      err instanceof Error ? err.message : String(err)
    );
  }
}
