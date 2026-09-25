import { getString } from '../_helpers.js';
import { normalizePhone } from '@sync-erp/shared/whatsapp';
import { getRedisClient } from './redis-client.js';

export const WHITELIST_KEY = 'whatsapp:allowed_phones';

export async function handleManageCustomerWhitelist(args: Record<string, unknown>): Promise<string> {
  const action = getString(args, 'action');
  if (!['add', 'remove', 'list'].includes(action)) {
    throw new Error(`action must be one of: add, remove, list. Got: ${action}`);
  }

  const redis = getRedisClient();

  if (action === 'list') {
    const phones = await redis.smembers(WHITELIST_KEY);
    return JSON.stringify({ phones });
  }

  const phone = getString(args, 'phone');
  const normalized = normalizePhone(phone);
  const local = normalized.startsWith('62') ? `0${normalized.slice(2)}` : normalized;

  if (action === 'add') {
    await redis.sadd(WHITELIST_KEY, normalized, local);
  } else {
    await redis.srem(WHITELIST_KEY, normalized, local);
  }

  const totalAllowed = await redis.scard(WHITELIST_KEY);
  return JSON.stringify({ success: true, action, phone: normalized, totalAllowed });
}
