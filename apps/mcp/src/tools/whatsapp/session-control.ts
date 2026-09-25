import { getString, getOptionalString } from '../_helpers.js';
import { normalizePhone } from '@sync-erp/shared/whatsapp';
import { getRedisClient } from './redis-client.js';

export const SESSION_MODE_TAKEOVER_TTL = 7200; // 2 hours

export async function handleTakeOverConversation(args: Record<string, unknown>): Promise<string> {
  const phone = getString(args, 'phone');
  const reason = getOptionalString(args, 'reason');
  const normalized = normalizePhone(phone);

  const redis = getRedisClient();
  await redis.set(`whatsapp:session_mode:${normalized}`, 'HUMAN', 'EX', SESSION_MODE_TAKEOVER_TTL);

  // eslint-disable-next-line no-console
  console.log(`[Mute Guard] ${normalized} set to HUMAN (take over, reason: ${reason ?? 'none'})`);

  return JSON.stringify({
    success: true,
    phone: normalized,
    message: 'Bot muted for 2 hours',
    reason,
  });
}

export async function handleReturnToBot(args: Record<string, unknown>): Promise<string> {
  const phone = getString(args, 'phone');
  const normalized = normalizePhone(phone);

  const redis = getRedisClient();
  await redis.del(`whatsapp:session_mode:${normalized}`);
  await redis.del(`whatsapp:session_mute:${normalized}`);

  // eslint-disable-next-line no-console
  console.log(`[Mute Guard] ${normalized} returned to BOT mode`);

  return JSON.stringify({ success: true, phone: normalized, message: 'Bot reactivated' });
}
