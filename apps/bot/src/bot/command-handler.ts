/**
 * Command Handler
 * Intercepts special slash commands (e.g. /restart, /ping) before message reaches AI dispatcher.
 */

import { clearChatHistory } from '../utils/chat-history';
import { getRedisClient } from './use-redis-auth-state';
import type { WASocket } from '@whiskeysockets/baileys';

export async function handleBotCommand(
  messageText: string,
  cleanPhone: string,
  sock: WASocket | null,
): Promise<boolean> {
  const trimmed = messageText.trim().toLowerCase();
  if (trimmed === '/restart') {
    // eslint-disable-next-line no-console
    console.log(
      `[command-handler] /restart command received from ${cleanPhone}. Wiping chat history & session...`,
    );
    try {
      await clearChatHistory(cleanPhone);
      const redis = getRedisClient();
      await redis.del(`whatsapp:session_mode:${cleanPhone}`);
      await redis.del(`whatsapp:customer_note:${cleanPhone}`);

      if (sock) {
        const restartJid = `${cleanPhone}@s.whatsapp.net`;
        await sock.sendMessage(restartJid, {
          text: 'Sesi percakapan Anda telah di-reset. Ada yang bisa kami bantu kembali seputar rental kasur Santi Living? 😊\n\n-r',
        });
      }
    } catch (err) {
      console.error('[command-handler] Error handling /restart command:', err);
    }
    return true;
  }

  if (trimmed === '/ping') {
    if (sock) {
      const pingJid = `${cleanPhone}@s.whatsapp.net`;
      await sock.sendMessage(pingJid, {
        text: 'pong! 🏓 Bot Santi Living aktif dan siap melayani.\n\n-r',
      });
    }
    return true;
  }

  return false;
}
