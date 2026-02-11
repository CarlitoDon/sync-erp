import {
  InvoiceStatusSchema,
  PaymentMethodTypeSchema,
} from '../types';

export const INVOICE_STATUS_OPTIONS = [
  { value: 'ALL', label: 'All' },
  ...Object.values(InvoiceStatusSchema.enum).map((status) => ({
    value: status,
    label: status.charAt(0) + status.slice(1).toLowerCase(),
  })),
  { value: 'VOID', label: 'Void' },
];

export const PAYMENT_METHOD_OPTIONS = Object.values(
  PaymentMethodTypeSchema.enum
).map((method) => ({
  value: method,
  label: method.replace('_', ' '),
}));

export const PRICING_TIER_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];
