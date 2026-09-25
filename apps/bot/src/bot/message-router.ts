/**
 * Message Router
 * Coordinates inbound WhatsApp message handling pipeline:
 * Filters -> LID resolution -> Staff check -> Whitelist -> Media download -> Commands -> History -> Debounce.
 */

import {
  jidNormalizedUser,
  jidDecode,
  type WASocket,
  type WAMessage,
} from '@whiskeysockets/baileys';
import { isInternalStaff } from '../constants/staff';
import { isCustomerAllowed } from '../utils/whitelist';
import { getBotConfig, isTestNumber } from '../config/bot.config';
import { appendChatHistory } from '../utils/chat-history';
import { resolvePhoneFromLid } from './use-redis-auth-state';
import { handleBotCommand } from './command-handler';
import { checkAiSalesEnabled } from './ai-sales-guard';
import { bufferIncomingMessage } from './debounce-buffer';
import {
  downloadInboundMedia,
  extractMessageContent,
} from './message-extractor';
import { setSessionMode } from './owner-takeover';
import { isBotSentMessage } from './bot-message-tracker';

export async function routeIncomingMessages(
  messages: WAMessage[],
  sock: WASocket,
): Promise<void> {
  for (const msg of messages) {
    if (!msg.key) continue;
    const remoteJid = msg.key.remoteJid;
    if (!remoteJid) continue;
    if (remoteJid.endsWith('@g.us')) continue; // Ignore group chats
    if (remoteJid.endsWith('@newsletter')) continue; // Ignore newsletters/channels
    if (remoteJid === 'status@broadcast' || remoteJid.endsWith('@broadcast')) continue;

    // Normalize JID and extract user phone number without device suffix
    const normalizedJid = jidNormalizedUser(remoteJid);
    const decoded = jidDecode(normalizedJid);
    const userPart = decoded?.user ?? remoteJid.split('@')[0].split(':')[0];
    const rawPhone = userPart.replace(/\D/g, '');
    if (!rawPhone) continue;

    let cleanPhone = rawPhone.startsWith('0') ? `62${rawPhone.slice(1)}` : rawPhone;

    // If message is from a WhatsApp LID, resolve the canonical phone number from Redis sync state
    if (remoteJid.endsWith('@lid')) {
      const resolved = await resolvePhoneFromLid(rawPhone);
      if (resolved) {
        cleanPhone = resolved.startsWith('0') ? `62${resolved.slice(1)}` : resolved;
        // eslint-disable-next-line no-console
        console.log(
          `[message-router] Resolved LID ${rawPhone} to canonical phone ${cleanPhone}`,
        );
      }
    }

    // Owner Outbound Takeover Detection:
    // If message is fromMe, check if owner sent manual message to customer to trigger auto-takeover
    if (msg.key.fromMe) {
      if (!getBotConfig().autoTakeoverEnabled) {
        continue;
      }

      if (isInternalStaff(cleanPhone) || (remoteJid.endsWith('@lid') && isInternalStaff(remoteJid))) {
        continue;
      }

      if (msg.key.id && isBotSentMessage(msg.key.id)) {
        continue;
      }

      // Owner manually sent a message to a customer -> activate takeover
      // eslint-disable-next-line no-console
      console.log(
        `[message-router] Manual outbound message from owner to ${cleanPhone} detected! Activating auto-takeover...`,
      );
      await setSessionMode(cleanPhone, 'HUMAN', 1800);

      const messageText = extractMessageContent(msg.message);
      if (messageText.trim()) {
        const timestamp = msg.messageTimestamp
          ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
          : new Date().toISOString();
        await appendChatHistory(cleanPhone, {
          role: 'assistant',
          name: 'Don (Owner)',
          text: messageText,
          timestamp,
        });
      }
      continue;
    }

    // Staff protection: ignore inbound messages from staff (unless explicitly designated as test number)
    const isStaff = isInternalStaff(cleanPhone) || (remoteJid.endsWith('@lid') && isInternalStaff(remoteJid));
    const isTester = isTestNumber(cleanPhone) || isTestNumber(rawPhone);

    if (isStaff && !isTester && getBotConfig().staffProtectionEnabled) {
      // eslint-disable-next-line no-console
      console.log(
        `[message-router] Inbound message from internal staff ${cleanPhone} ignored to prevent feedback loop.`,
      );
      continue;
    }

    // Customer whitelist check
    const cleanAllowed = await isCustomerAllowed(cleanPhone);
    const rawAllowed = await isCustomerAllowed(rawPhone);
    if (!cleanAllowed && !rawAllowed) {
      // eslint-disable-next-line no-console
      console.log(
        `[message-router] Inbound customer message from ${cleanPhone} (raw: ${rawPhone}) ignored: Not in whitelist.`,
      );
      continue;
    }

    // Try downloading media if an image or document is attached
    const media = await downloadInboundMedia(msg, sock, cleanPhone);

    // Extract message text (with media tag if downloaded)
    const messageText = extractMessageContent(msg.message, media);
    if (!messageText.trim()) continue;

    // Check for special slash commands
    const isCommand = await handleBotCommand(messageText, cleanPhone, sock);
    if (isCommand) continue;

    // Check emergency killswitch / AI sales toggle
    const aiSalesActive = await checkAiSalesEnabled();
    if (!aiSalesActive) {
      // eslint-disable-next-line no-console
      console.log(
        `[message-router] Inbound customer message from ${cleanPhone} ignored: AI Sales is disabled (Emergency Cut).`,
      );
      continue;
    }

    const customerPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;
    const customerName = msg.pushName || 'Customer';
    const timestamp = msg.messageTimestamp
      ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
      : new Date().toISOString();

    // Record incoming message in chat history
    await appendChatHistory(cleanPhone, {
      role: 'customer',
      name: customerName,
      text: messageText,
      timestamp,
    });

    // Buffer incoming message in debounce buffer
    bufferIncomingMessage(
      cleanPhone,
      customerPhone,
      customerName,
      messageText,
      timestamp,
      sock,
      media?.fileUrl,
    );
  }
}
