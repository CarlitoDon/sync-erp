/**
 * Owner Takeover & Mute Guard
 * Manages Redis session modes ('HUMAN' vs 'BOT') to mute AI responses when owner/staff takes over.
 */

import { getRedisClient } from './use-redis-auth-state';

export type SessionMode = 'HUMAN' | 'BOT';

export async function isSessionMuted(cleanPhone: string): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const mode = await redis.get(`whatsapp:session_mode:${cleanPhone}`);
    return mode === 'HUMAN';
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '[mute-guard] Redis error checking session_mode:',
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

export async function setSessionMode(
  cleanPhone: string,
  mode: SessionMode,
  ttlSeconds = 1800,
): Promise<void> {
  const redis = getRedisClient();
  const key = `whatsapp:session_mode:${cleanPhone}`;
  if (mode === 'HUMAN') {
    await redis.set(key, 'HUMAN', 'EX', ttlSeconds);
  } else {
    await redis.del(key);
  }
}
