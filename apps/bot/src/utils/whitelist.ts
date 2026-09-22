/**
 * Customer whitelist utilities for AI Sales testing.
 * Restricts inbound and outbound messages strictly to configured numbers (e.g. wife-only).
 *
 * Storage is now Redis-backed (dynamic) via Set `whatsapp:allowed_phones`.
 * On startup, `apps/bot/src/index.ts` seeds phones from ALLOWED_CUSTOMER_PHONES into Redis.
 */
import { getRedisClient } from '../bot/use-redis-auth-state.js';
import { isInternalStaff, INTERNAL_STAFF_PHONES, INTERNAL_STAFF_LIDS } from '../constants/staff.js';

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
 * Internal staff numbers are strictly filtered out.
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
      .filter((p) => p.length > 0 && !isInternalStaff(p))
  );
}

/**
 * Checks whether a customer phone number is permitted.
 * Unconditionally blocks internal staff numbers.
 * Reads from Redis Set `whatsapp:allowed_phones`.
 * Fail-closed: If the set is empty or Redis errors, returns false.
 */
export async function isCustomerAllowed(phone: string): Promise<boolean> {
  if (isInternalStaff(phone)) {
    return false;
  }
  const clean = normalizePhone(phone);
  if (isInternalStaff(clean)) {
    return false;
  }

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
 * Automatically purges any internal staff phone numbers that may exist in Redis whitelist.
 * Uses SADD so it does NOT wipe valid existing customer entries.
 */
export async function seedWhitelistFromEnv(): Promise<void> {
  try {
    const redis = getRedisClient();

    // 1. Unconditionally purge internal staff phone numbers & LIDs from Redis whitelist
    const staffToPurge: string[] = [];
    for (const staffPhone of INTERNAL_STAFF_PHONES) {
      staffToPurge.push(staffPhone);
      if (staffPhone.startsWith('62')) {
        staffToPurge.push(`0${staffPhone.slice(2)}`);
      }
    }
    for (const staffLid of INTERNAL_STAFF_LIDS) {
      staffToPurge.push(staffLid);
    }
    if (staffToPurge.length > 0) {
      await redis.srem(WHITELIST_KEY, ...staffToPurge);
    }

    // 2. Unconditionally purge any leftover chat history, session mode, or customer notes for internal staff
    for (const staffPhone of INTERNAL_STAFF_PHONES) {
      await redis.del(`whatsapp:chat_history:${staffPhone}`);
      await redis.del(`whatsapp:session_mode:${staffPhone}`);
      await redis.del(`whatsapp:customer_note:${staffPhone}`);
      if (staffPhone.startsWith('62')) {
        const localPhone = `0${staffPhone.slice(2)}`;
        await redis.del(`whatsapp:chat_history:${localPhone}`);
        await redis.del(`whatsapp:session_mode:${localPhone}`);
        await redis.del(`whatsapp:customer_note:${localPhone}`);
      }
    }

    // 3. Seed allowed customer phones (filtered against internal staff)
    const phones = getAllowedCustomerPhones();
    const safePhones = Array.from(phones).filter((p) => !isInternalStaff(p));
    if (safePhones.length > 0) {
      await redis.sadd(WHITELIST_KEY, ...safePhones);
      // eslint-disable-next-line no-console
      console.log(
        `[whitelist] Seeded ${safePhones.length} phone(s) into Redis whitelist from ALLOWED_CUSTOMER_PHONES.`
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[whitelist] Failed to seed whitelist into Redis:',
      err instanceof Error ? err.message : String(err)
    );
  }
}
