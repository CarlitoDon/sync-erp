export const PAYMENT_METHOD_TYPES = [
  'CASH',
  'BANK',
  'QRIS',
  'EWALLET',
  'OTHER',
] as const;

export type PaymentMethodType =
  (typeof PAYMENT_METHOD_TYPES)[number];

export const PAYMENT_METHOD_TYPE_LABELS: Record<
  PaymentMethodType,
  string
> = {
  CASH: 'Tunai',
  BANK: 'Bank',
  QRIS: 'QRIS',
  EWALLET: 'E-Wallet',
  OTHER: 'Lainnya',
};

export const PAYMENT_METHOD_TYPE_COLORS: Record<
  PaymentMethodType,
  'default' | 'secondary' | 'outline'
> = {
  CASH: 'default',
  BANK: 'secondary',
  QRIS: 'outline',
  EWALLET: 'outline',
  OTHER: 'outline',
};

export const PAYMENT_METHOD_TYPE_OPTIONS = PAYMENT_METHOD_TYPES.map(
  (value) => ({
    value,
    label: PAYMENT_METHOD_TYPE_LABELS[value],
  })
);

