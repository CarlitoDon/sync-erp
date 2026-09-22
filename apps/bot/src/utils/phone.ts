import { formatJid } from '@sync-erp/shared/whatsapp';

/**
 * @deprecated Use formatJid from @sync-erp/shared/whatsapp instead
 */
export const formatPhoneNumber = (phone: string): string => {
  return formatJid(phone);
};

export const isValidIndonesianNumber = (phone: string): boolean => {
  const cleaned = phone.replace(/[\s-]/g, "");
  return /^(\+?62|0)8[1-9][0-9]{6,12}$/.test(cleaned);
};
