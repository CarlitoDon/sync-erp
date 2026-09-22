/**
 * Bot-sent message tracking: avoids self-triggering auto-takeover on bot egress
 */

const botSentMessageIds = new Set<string>();
const MAX_BOT_SENT_IDS = 1000;

export function recordBotSentMessageId(messageId: string): void {
  if (!messageId || messageId === 'unknown') return;
  botSentMessageIds.add(messageId);
  if (botSentMessageIds.size > MAX_BOT_SENT_IDS) {
    const first = botSentMessageIds.values().next().value;
    if (first) {
      botSentMessageIds.delete(first);
    }
  }
}

export function isBotSentMessage(messageId: string | null | undefined): boolean {
  if (!messageId) return false;
  return botSentMessageIds.has(messageId);
}

export function clearBotSentMessageIds(): void {
  botSentMessageIds.clear();
}
