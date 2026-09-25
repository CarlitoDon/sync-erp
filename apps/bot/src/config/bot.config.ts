import { normalizePhone } from '@sync-erp/shared/whatsapp';

function parseBool(val: string | undefined, defaultValue: boolean): boolean {
  if (val === undefined || val.trim() === '') return defaultValue;
  const lower = val.trim().toLowerCase();
  return lower === 'true' || lower === '1';
}

function parsePhonesList(val: string | undefined): Set<string> {
  if (!val || !val.trim()) return new Set<string>();
  return new Set(
    val
      .split(',')
      .map((p) => normalizePhone(p.trim()))
      .filter((p) => p.length > 0),
  );
}

export interface BotConfig {
  whitelistEnabled: boolean;
  staffProtectionEnabled: boolean;
  autoTakeoverEnabled: boolean;
  testNumbers: Set<string>;
  allowedCustomerPhones: Set<string>;
  webhookUrl: string;
  debounceMs: number;
}

/**
 * Reads dynamic bot configuration from environment variables.
 */
export function getBotConfig(): BotConfig {
  const whitelistEnabled = parseBool(
    process.env.BOT_WHITELIST_ENABLED ?? process.env.WHITELIST_ENABLED,
    true,
  );

  const staffProtectionEnabled = parseBool(
    process.env.STAFF_PROTECTION_ENABLED ?? process.env.BOT_IGNORE_STAFF,
    true,
  );

  const autoTakeoverEnabled = parseBool(
    process.env.AUTO_TAKEOVER_ENABLED ?? process.env.BOT_AUTO_TAKEOVER,
    true,
  );

  const testNumbers = parsePhonesList(
    process.env.BOT_TEST_NUMBERS ?? process.env.TEST_CUSTOMER_PHONES,
  );

  const allowedCustomerPhones = parsePhonesList(
    process.env.ALLOWED_CUSTOMER_PHONES,
  );

  const webhookUrl =
    process.env.CARLA_WEBHOOK_URL ||
    process.env.RARA_WEBHOOK_URL ||
    process.env.BOT_WEBHOOK_URL ||
    'http://localhost:8045/webhook/rara';

  const debounceMs = Number(process.env.WHATSAPP_DEBOUNCE_MS) || 7000;

  return {
    whitelistEnabled,
    staffProtectionEnabled,
    autoTakeoverEnabled,
    testNumbers,
    allowedCustomerPhones,
    webhookUrl,
    debounceMs,
  };
}

/**
 * Checks whether an incoming phone number or LID is explicitly designated as a tester.
 * Test numbers bypass internal staff protection and whitelist checks.
 */
export function isTestNumber(identifier: string | null | undefined): boolean {
  if (!identifier) return false;
  const raw = identifier.trim();
  if (!raw) return false;

  const userPart = raw.split('@')[0].split(':')[0];
  const digits = userPart.replace(/\D/g, '');
  if (!digits) return false;

  const normalized = digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
  const { testNumbers } = getBotConfig();

  return testNumbers.has(normalized) || testNumbers.has(digits) || testNumbers.has(userPart);
}
