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
 * 1. Test numbers (BOT_TEST_NUMBERS) are always permitted (bypasses staff check & whitelist).
 * 2. Internal staff numbers are blocked if staffProtectionEnabled is true.
 * 3. If whitelistEnabled is false, all non-staff numbers are permitted.
 * 4. Otherwise, checks Redis Set `whatsapp:allowed_phones`.
 */
export async function isCustomerAllowed(phone: string): Promise<boolean> {
  const clean = normalizePhone(phone);

  // 1. Explicit tester numbers bypass all restrictions
  if (isTestNumber(phone) || isTestNumber(clean)) {
    return true;
  }

  const { whitelistEnabled, staffProtectionEnabled } = getBotConfig();

  // 2. Staff check
  if (staffProtectionEnabled) {
    if (isInternalStaff(phone) || isInternalStaff(clean)) {
      return false;
    }
  }

  // 3. Open mode: whitelist disabled
  if (!whitelistEnabled) {
    return true;
  }

  // 4. Redis whitelist lookup
  try {
    const redis = getRedisClient();
    const isMember = await redis.sismember(WHITELIST_KEY, clean);
    return isMember === 1;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[whitelist] Redis error checking isCustomerAllowed:',
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

/**
 * Seeds ALLOWED_CUSTOMER_PHONES and BOT_TEST_NUMBERS env vars into Redis whitelist on startup.
 * Automatically purges any internal staff phone numbers that may exist in Redis whitelist
 * (unless explicitly designated as test numbers).
 */
export async function seedWhitelistFromEnv(): Promise<void> {
  try {
    const redis = getRedisClient();
    const { testNumbers, staffProtectionEnabled } = getBotConfig();

    // 1. Purge internal staff phone numbers & LIDs from Redis whitelist (except test numbers)
    if (staffProtectionEnabled) {
      const staffToPurge: string[] = [];
      for (const staffPhone of INTERNAL_STAFF_PHONES) {
        if (!isTestNumber(staffPhone)) {
          staffToPurge.push(staffPhone);
          if (staffPhone.startsWith('62')) {
            staffToPurge.push(`0${staffPhone.slice(2)}`);
          }
        }
      }
      for (const staffLid of INTERNAL_STAFF_LIDS) {
        if (!isTestNumber(staffLid)) {
          staffToPurge.push(staffLid);
        }
      }
      if (staffToPurge.length > 0) {
        await redis.srem(WHITELIST_KEY, ...staffToPurge);
      }

      // 2. Purge leftover session mode / customer notes for non-test staff
      for (const staffPhone of INTERNAL_STAFF_PHONES) {
        if (!isTestNumber(staffPhone)) {
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
      }
    }

    // 3. Seed allowed customer phones + test numbers
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
