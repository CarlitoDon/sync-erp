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
 * Get external asset URL for integrations (images, etc)
 */
export const getExternalAssetUrl = (integrationConfig: Record<string, unknown> | null, path: string): string => {
  if (!path) return '';

  // If already a full URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const baseUrl = (integrationConfig?.assetBaseUrl as string) || '';

  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
};
