/**
 * Customer whitelist utilities for AI Sales testing.
 * Restricts inbound and outbound messages strictly to configured numbers (e.g. wife-only).
 *
 * Storage is Redis-backed (dynamic) via Set `whatsapp:allowed_phones`.
 * On startup, `apps/bot/src/index.ts` seeds phones from ALLOWED_CUSTOMER_PHONES into Redis.
 * Supports environment controls:
 * - BOT_WHITELIST_ENABLED (true/false)
 * - BOT_TEST_NUMBERS (comma-separated, bypasses staff protection and whitelist)
 * - STAFF_PROTECTION_ENABLED (true/false)
 */
import { getRedisClient } from '../bot/use-redis-auth-state.js';
import { isInternalStaff, INTERNAL_STAFF_PHONES, INTERNAL_STAFF_LIDS } from '../constants/staff.js';
import { getBotConfig, isTestNumber } from '../config/bot.config.js';
import { normalizePhone } from '@sync-erp/shared/whatsapp';

const WHITELIST_KEY = 'whatsapp:allowed_phones';

/**
 * Parses the ALLOWED_CUSTOMER_PHONES environment variable into a Set of normalized phone strings.
 * Internal staff numbers are filtered out unless explicitly designated as test numbers.
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
      .filter((p) => p.length > 0 && (!isInternalStaff(p) || isTestNumber(p))),
  );
}

/**
 * Checks whether a customer phone number is permitted to chat with the bot.
 * SINGLE SOURCE OF TRUTH:
 * 1. If explicit test number, ALWAYS permitted.
 * 2. If present in Redis Set whatsapp:allowed_phones, ALWAYS permitted (even if staff/tester).
 * 3. If internal staff (and not whitelisted in Redis), BLOCKED to protect internal chats.
 * 4. If whitelist is disabled (open public mode), all non-staff permitted.
 * 5. If whitelist is enabled and not in Redis, BLOCKED.
 */
export async function isCustomerAllowed(phone: string): Promise<boolean> {
  const clean = normalizePhone(phone);

  // 1. Explicit tester numbers bypass all restrictions
  if (isTestNumber(phone) || isTestNumber(clean)) {
    return true;
  }

  // 2. Single source of truth: Redis whitelist lookup
  try {
    const redis = getRedisClient();
    const isMember =
      (await redis.sismember(WHITELIST_KEY, clean)) === 1 ||
      (await redis.sismember(WHITELIST_KEY, phone)) === 1;
    if (isMember) {
      return true;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[whitelist] Redis error checking isCustomerAllowed:',
      err instanceof Error ? err.message : String(err),
    );
  }

  const { whitelistEnabled, staffProtectionEnabled } = getBotConfig();

  // 3. Staff check: internal staff blocked unless explicitly whitelisted above
  if (staffProtectionEnabled) {
    if (isInternalStaff(phone) || isInternalStaff(clean)) {
      return false;
    }
  }

  // 4. Open mode: whitelist disabled
  if (!whitelistEnabled) {
    return true;
  }

  // 5. Whitelist enabled and not in Redis
  return false;
}

/**
 * Seeds ALLOWED_CUSTOMER_PHONES and BOT_TEST_NUMBERS env vars into Redis whitelist on startup.
 * Does NOT purge existing whitelisted numbers in Redis.
 */
export async function seedWhitelistFromEnv(): Promise<void> {
  try {
    const redis = getRedisClient();
    const { testNumbers, staffProtectionEnabled } = getBotConfig();

    // Seed allowed customer phones + test numbers if configured
    const phones = getAllowedCustomerPhones();
    for (const testPhone of testNumbers) {
      phones.add(testPhone);
    }

    const safePhones = Array.from(phones).filter(
      (p) => !staffProtectionEnabled || !isInternalStaff(p) || isTestNumber(p),
    );

    if (safePhones.length > 0) {
      await redis.sadd(WHITELIST_KEY, ...safePhones);
      // eslint-disable-next-line no-console
      console.log(
        `[whitelist] Seeded ${safePhones.length} phone(s) into Redis whitelist from environment config.`,
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[whitelist] Failed to seed whitelist into Redis:',
      err instanceof Error ? err.message : String(err),
    );
  }
}
