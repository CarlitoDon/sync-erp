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

<<<<<<< HEAD
export const getExternalAssetUrl = (path: string): string => {
=======
/**
 * Get external asset URL for integrations (images, etc)
 */
export const getExternalAssetUrl = (integrationConfig: Record<string, unknown> | null, path: string): string => {
>>>>>>> origin/dev
  if (!path) return '';

  // If already a full URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

<<<<<<< HEAD
  const baseUrl =
    import.meta.env.VITE_EXTERNAL_ASSET_BASE_URL || 'http://localhost:4321';
=======
  const baseUrl = (integrationConfig?.assetBaseUrl as string) || '';
>>>>>>> origin/dev

  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
};
