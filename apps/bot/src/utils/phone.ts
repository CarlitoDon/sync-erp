import { formatJid } from '@sync-erp/shared/whatsapp';

/**
 * @deprecated Use formatJid from @sync-erp/shared/whatsapp instead
 */
export const formatPhoneNumber = (phone: string): string => {
  // Remove non-digits
  let cleaned = phone.replace(/[\s-]/g, "");

  // Replace leading 0 with 62
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.substring(1);
  } else if (cleaned.startsWith("+62")) {
    cleaned = cleaned.substring(1);
  }

  // Add WhatsApp suffix if not present
  if (!cleaned.endsWith("@s.whatsapp.net")) {
    cleaned += "@s.whatsapp.net";
  }

  return cleaned;
};

export const isValidIndonesianNumber = (phone: string): boolean => {
  const cleaned = phone.replace(/[\s-]/g, "");
  return /^(\+?62|0)8[1-9][0-9]{6,12}$/.test(cleaned);
};
