/**
 * Frustration Detector
 * Detects consecutive clarification requests or repeated apologies from bot history
 * to avoid customer frustration loops.
 */

import { getRedisClient } from './use-redis-auth-state';

export const CLARIFICATION_PATTERN = /maaf.*(?:perjelas|ulangi|jelaskan|paham|mengerti)/i;
export const CLARIFICATION_PHRASES = ['bisa diperjelas', 'kurang paham', 'mohon maaf'];
export const FRUSTRATION_THRESHOLD = 2;

export function isClarificationMessage(text: string): boolean {
  const lower = text.toLowerCase();
  if (CLARIFICATION_PATTERN.test(text)) return true;
  return CLARIFICATION_PHRASES.some((phrase) => lower.includes(phrase));
}

export async function getChatHistoryRaw(
  cleanPhone: string,
): Promise<Array<{ role: string; text: string }>> {
  try {
    const redis = getRedisClient();
    const key = `whatsapp:chat_history:${cleanPhone}`;
    const rawList = await redis.lrange(key, -6, -1); // last 6 messages
    const entries: Array<{ role: string; text: string }> = [];
    for (const item of rawList) {
      try {
        const parsed: unknown = JSON.parse(item);
        if (
          parsed &&
          typeof parsed === 'object' &&
          'role' in parsed &&
          'text' in parsed &&
          typeof (parsed as Record<string, unknown>).role === 'string' &&
          typeof (parsed as Record<string, unknown>).text === 'string'
        ) {
          const entry = parsed as { role: string; text: string };
          entries.push({ role: entry.role, text: entry.text });
        }
      } catch {
        // skip
      }
    }
    return entries;
  } catch {
    return [];
  }
}

export async function detectFrustration(cleanPhone: string): Promise<{
  detected: boolean;
  count: number;
}> {
  const history = await getChatHistoryRaw(cleanPhone);
  let consecutiveClarifications = 0;
  for (const msg of [...history].reverse()) {
    if (msg.role !== 'assistant') break;
    if (isClarificationMessage(msg.text)) {
      consecutiveClarifications++;
    } else {
      break;
    }
  }
  return {
    detected: consecutiveClarifications >= FRUSTRATION_THRESHOLD,
    count: consecutiveClarifications,
  };
}
