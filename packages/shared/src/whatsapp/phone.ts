/**
 * Normalizes phone number into international digit format without '+' or spaces.
 * E.g., '08123456789' -> '628123456789', '+62 812-3456-789' -> '628123456789'
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  return digits;
}

/**
 * Converts a normalized phone string into a standard WhatsApp JID
 */
export function formatJid(phone: string): string {
  const normalized = normalizePhone(phone);
  return `${normalized}@s.whatsapp.net`;
}

/**
 * Checks if a string is a valid Indonesian mobile number
 */
export const isValidIndonesianNumber = (phone: string): boolean => {
  const cleaned = phone.replace(/[\s-]/g, "");
  return /^(\+?62|0)8[1-9][0-9]{6,12}$/.test(cleaned);
};
