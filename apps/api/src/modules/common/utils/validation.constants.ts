/* eslint-disable @sync-erp/no-hardcoded-enum */
export const VALIDATION_DOCUMENT_TYPES = {
  BILL: 'Bill',
  INVOICE: 'Invoice',
} as const;

export type ValidationDocumentType =
  (typeof VALIDATION_DOCUMENT_TYPES)[keyof typeof VALIDATION_DOCUMENT_TYPES];

export const VALIDATION_ORDER_TYPES = {
  PO: 'PO',
  SO: 'SO',
} as const;

export const VALIDATION_FULFILLMENT_TYPES = {
  GRN: 'GRN',
  SHIPMENT: 'Shipment',
} as const;

export const VALIDATION_FULFILLMENT_ACTIONS = {
  RECEIVED: 'Received',
  SHIPPED: 'Shipped',
} as const;
