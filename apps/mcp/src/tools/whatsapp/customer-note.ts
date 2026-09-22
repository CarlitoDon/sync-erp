import { getString } from '../_helpers.js';
import { isInternalStaff } from '../../constants/staff.js';
import { normalizePhone } from '@sync-erp/shared/whatsapp';
import { getRedisClient } from './redis-client.js';

export const CUSTOMER_NOTE_TTL = 2592000; // 30 days

export async function handleSetCustomerNote(args: Record<string, unknown>): Promise<string> {
  const phone = getString(args, 'phone');
  const note = getString(args, 'note');

  if (isInternalStaff(phone)) {
    throw new Error(`Cannot set customer note for internal staff or store phone: ${phone}`);
  }

  const normalized = normalizePhone(phone);
  if (isInternalStaff(normalized)) {
    throw new Error(`Cannot set customer note for internal staff or store phone: ${phone}`);
  }
  const key = `whatsapp:customer_note:${normalized}`;
  const redis = getRedisClient();

  await redis.set(key, note, 'EX', CUSTOMER_NOTE_TTL);

  return JSON.stringify({ success: true, phone: normalized, note });
}
