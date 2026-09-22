import { getRedisClient } from '../bot/use-redis-auth-state';

export interface ChatHistoryEntry {
  role: 'customer' | 'assistant';
  name: string;
  text: string;
  timestamp: string;
}

const HISTORY_KEY_PREFIX = 'whatsapp:chat_history:';
const MAX_HISTORY_MESSAGES = 12;
const HISTORY_TTL_SECONDS = 86400; // 24 hours

/**
 * Appends a message to the customer's rolling chat history in Redis.
 */
export async function appendChatHistory(
  phone: string,
  entry: ChatHistoryEntry
): Promise<void> {
  try {
    const redis = getRedisClient();
    const cleanPhone = phone.replace(/\D/g, '');
    const key = `${HISTORY_KEY_PREFIX}${cleanPhone}`;
    const serialized = JSON.stringify(entry);

    await redis.rpush(key, serialized);
    await redis.ltrim(key, -MAX_HISTORY_MESSAGES, -1);
    await redis.expire(key, HISTORY_TTL_SECONDS);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[ChatHistory] Failed to append chat history for ${phone}:`,
      err instanceof Error ? err.message : String(err)
    );
  }
}

/**
 * Clears the chat history and any customer note for a phone in Redis.
 */
export async function clearChatHistory(phone: string): Promise<void> {
  try {
    const redis = getRedisClient();
    const cleanPhone = phone.replace(/\D/g, '');
    await redis.del(`${HISTORY_KEY_PREFIX}${cleanPhone}`);
    await redis.del(`whatsapp:customer_note:${cleanPhone}`);
    await redis.del(`whatsapp:session_mode:${cleanPhone}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[ChatHistory] Failed to clear chat history for ${phone}:`,
      err instanceof Error ? err.message : String(err)
    );
  }
}

/**
 * Retrieves the recent chat history for a customer formatted as readable conversation transcript.
 */
export async function getFormattedChatHistory(phone: string): Promise<string> {
  try {
    const redis = getRedisClient();
    const cleanPhone = phone.replace(/\D/g, '');
    const key = `${HISTORY_KEY_PREFIX}${cleanPhone}`;
    const rawList = await redis.lrange(key, 0, -1);

    if (!rawList || rawList.length === 0) {
      return '(Percakapan baru - belum ada riwayat sebelumnya)';
    }

    const lines: string[] = [];
    for (const item of rawList) {
      try {
        const parsed: unknown = JSON.parse(item);
        if (
          parsed &&
          typeof parsed === 'object' &&
          'name' in parsed &&
          'text' in parsed
        ) {
          const entry = parsed as { name: string; text: string };
          lines.push(`${entry.name}: ${entry.text}`);
        }
      } catch {
        // Skip unparseable entry
      }
    }

    return lines.join('\n');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      `[ChatHistory] Failed to get chat history for ${phone}:`,
      err instanceof Error ? err.message : String(err)
    );
    return '(Riwayat chat tidak tersedia)';
  }
}
