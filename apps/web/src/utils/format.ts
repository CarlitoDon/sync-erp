import {
  formatCurrency as sharedFormatCurrency,
  formatNumber as sharedFormatNumber,
  formatDate as sharedFormatDate,
  formatTime as sharedFormatTime,
  formatDateTime as sharedFormatDateTime,
} from '@sync-erp/shared';

export const formatCurrency = (value: number, currency = 'IDR') => {
  return sharedFormatCurrency(value, currency);
};

export const formatNumber = (value: number) => {
  return sharedFormatNumber(value);
};

export const formatDate = (date: string | Date) => {
  return sharedFormatDate(date);
};

export const formatTime = (date: string | Date) => {
  return sharedFormatTime(date);
};

export const formatDateTime = (date: string | Date) => {
  return sharedFormatDateTime(date);
};

/**
 * Get Santi Living asset URL (images, etc)
 * In development: uses localhost:4321 (Astro dev server)
 * In production: uses santiliving.com
 */
export const getSantiLivingAssetUrl = (path: string): string => {
  if (!path) return '';

  // If already a full URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const isDev = import.meta.env.DEV;
  const baseUrl = isDev
    ? 'http://localhost:4321'
    : 'https://santiliving.com';

  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
};
