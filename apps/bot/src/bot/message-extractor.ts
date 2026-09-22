/**
 * Message Extractor
 * Parses text, coordinates, attachments, and downloads inbound media via Baileys.
 */

import {
  proto,
  downloadMediaMessage,
  type WASocket,
  type WAMessage,
} from '@whiskeysockets/baileys';
import fs from 'node:fs/promises';
import path from 'path';
import pino from 'pino';

const logger = pino({ level: 'silent' });

export interface ExtractedMedia {
  filePath: string;
  fileUrl: string;
  mimeType: string;
  fileName: string;
  isImage: boolean;
  isPaymentProof: boolean;
}

const MIME_EXT_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

const PAYMENT_KEYWORDS = [
  'transfer',
  'bayar',
  'bukti',
  'struk',
  'dp',
  'lunas',
  'bca',
  'qris',
  'nominal',
  'sudah tf',
  'dah tf',
];

export function isPaymentContext(text: string): boolean {
  const lower = text.toLowerCase();
  return PAYMENT_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function downloadInboundMedia(
  rawMsg: WAMessage,
  sock: WASocket,
  cleanPhone: string,
): Promise<ExtractedMedia | null> {
  if (!rawMsg.key) return null;

  const message =
    rawMsg.message?.ephemeralMessage?.message ||
    rawMsg.message?.viewOnceMessage?.message ||
    rawMsg.message?.viewOnceMessageV2?.message ||
    rawMsg.message?.documentWithCaptionMessage?.message ||
    rawMsg.message;

  if (!message) return null;

  const imageMsg = message.imageMessage;
  const docMsg = message.documentMessage;

  if (!imageMsg && !docMsg) return null;

  try {
    const isImage = Boolean(imageMsg || docMsg?.mimetype?.startsWith('image/'));
    const mimeType = imageMsg?.mimetype || docMsg?.mimetype || 'image/jpeg';
    const ext = MIME_EXT_MAP[mimeType] || (isImage ? '.jpg' : '.bin');
    const msgId = rawMsg.key.id || `msg-${Date.now()}`;
    const timestamp = Date.now();
    const fileName = `${timestamp}-${msgId}${ext}`;

    const storageDir = path.resolve(process.cwd(), 'storage/inbound-media', cleanPhone);
    await fs.mkdir(storageDir, { recursive: true });
    const filePath = path.join(storageDir, fileName);

    const buffer = await downloadMediaMessage(
      rawMsg,
      'buffer',
      {},
      {
        logger,
        reuploadRequest: sock.updateMediaMessage,
      },
    );

    if (!buffer || buffer.length === 0) {
      return null;
    }

    await fs.writeFile(filePath, buffer);

    const fileUrl = `/media/${cleanPhone}/${fileName}`;
    const caption = imageMsg?.caption || docMsg?.caption || '';
    const isPaymentProof = isImage && (isPaymentContext(caption) || !caption);

    // eslint-disable-next-line no-console
    console.log(
      `[message-extractor] Inbound media saved from ${cleanPhone}: ${fileUrl} (${buffer.length} bytes, paymentProof=${isPaymentProof})`,
    );

    return {
      filePath,
      fileUrl,
      mimeType,
      fileName,
      isImage,
      isPaymentProof,
    };
  } catch (err) {
    console.error('[message-extractor] Failed to download inbound media:', err);
    return null;
  }
}

export function extractMessageContent(
  msg: proto.IMessage | null | undefined,
  downloadedMedia: ExtractedMedia | null = null,
): string {
  if (!msg) return '';
  const message =
    msg.ephemeralMessage?.message ||
    msg.viewOnceMessage?.message ||
    msg.viewOnceMessageV2?.message ||
    msg.documentWithCaptionMessage?.message ||
    msg;

  if (message.locationMessage) {
    const loc = message.locationMessage;
    const parts: string[] = [];
    if (loc.name) parts.push(loc.name);
    if (loc.address) parts.push(loc.address);
    if (loc.degreesLatitude != null && loc.degreesLongitude != null) {
      parts.push(`(Koordinat: ${loc.degreesLatitude}, ${loc.degreesLongitude})`);
      parts.push(`https://maps.google.com/?q=${loc.degreesLatitude},${loc.degreesLongitude}`);
    }
    if (loc.comment) parts.push(loc.comment);
    if (loc.url) parts.push(loc.url);
    return parts.join(' - ') || '[Share Location]';
  }

  if (message.liveLocationMessage) {
    const loc = message.liveLocationMessage;
    const parts: string[] = ['[Live Location]'];
    if (loc.degreesLatitude != null && loc.degreesLongitude != null) {
      parts.push(`(Koordinat: ${loc.degreesLatitude}, ${loc.degreesLongitude})`);
      parts.push(`https://maps.google.com/?q=${loc.degreesLatitude},${loc.degreesLongitude}`);
    }
    if (loc.caption) parts.push(loc.caption);
    return parts.join(' - ');
  }

  if (message.imageMessage) {
    const caption = message.imageMessage.caption?.trim();
    const mediaTag = downloadedMedia
      ? `[Media URL: ${downloadedMedia.fileUrl}]`
      : '';
    const captionText = caption ? ` "${caption}"` : '';
    return `[Mengirim Gambar / Bukti Pembayaran${captionText}] ${mediaTag}`.trim();
  }

  if (message.documentMessage) {
    const filename = message.documentMessage.fileName || 'Dokumen';
    const caption = message.documentMessage.caption?.trim();
    const mediaTag = downloadedMedia
      ? `[Media URL: ${downloadedMedia.fileUrl}]`
      : '';
    const captionText = caption ? ` - "${caption}"` : '';
    return `[Mengirim Dokumen / File: "${filename}"${captionText}] ${mediaTag}`.trim();
  }

  if (message.videoMessage) {
    const caption = message.videoMessage.caption?.trim();
    return caption ? `[Mengirim Video: "${caption}"]` : '[Mengirim Video]';
  }

  if (message.stickerMessage) {
    return '[Stiker]';
  }

  if (message.audioMessage) {
    return '[Pesan Suara / Audio]';
  }

  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    ''
  );
}
