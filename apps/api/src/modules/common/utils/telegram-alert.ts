/**
 * Utility to send administrative Telegram alert notifications.
 * Never throws an exception and never leaks the bot token in logs.
 */
export async function sendTelegramAlert(text: string): Promise<boolean> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatIdsRaw = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();

    if (!text || text.trim().length === 0) {
      return false;
    }

    if (!token || !chatIdsRaw) {
      console.warn(
        '[TelegramAlert] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID; skipping alert'
      );
      return false;
    }

    const chatIds = chatIdsRaw
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    if (chatIds.length === 0) {
      console.warn(
        '[TelegramAlert] No valid chat IDs found in TELEGRAM_ADMIN_CHAT_ID; skipping alert'
      );
      return false;
    }

    let successCount = 0;

    for (const chatId of chatIds) {
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${token}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text,
            }),
            signal: AbortSignal.timeout(5000),
          }
        );

        if (response.ok) {
          successCount++;
        } else {
          console.warn(
            `[TelegramAlert] Failed to send message to chat ${chatId}: HTTP ${response.status}`
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[TelegramAlert] Error sending message to chat ${chatId}: ${msg}`
        );
      }
    }

    return successCount > 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[TelegramAlert] Unexpected failure in sendTelegramAlert: ${msg}`);
    return false;
  }
}
