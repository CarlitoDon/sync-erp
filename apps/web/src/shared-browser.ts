// Browser-safe shared entry point.
// Keep server environment validation and test-only helpers out of the web graph.
export {
  APP_NAME,
  APP_VERSION,
  HEADERS,
  PAGINATION,
  ERROR_CODES,
  ORDER_STATUS_TRANSITIONS,
  INVOICE_STATUS_TRANSITIONS,
  MODULES,
  ACTIONS,
  SCOPES,
  PAYMENT_TERMS,
} from '../../../packages/shared/src/constants/index';
export * from '../../../packages/shared/src/constants/inventory';
export * from '../../../packages/shared/src/constants/billing';
export * from '../../../packages/shared/src/errors/index';
export * from '../../../packages/shared/src/constants/ui-constants';
export * from '../../../packages/shared/src/types/index';
export * from '../../../packages/shared/src/validators/index';
export * from '../../../packages/shared/src/domain/Money';
export * from '../../../packages/shared/src/domain/BusinessDate';
export * from '../../../packages/shared/src/utils/paymentTerms';
export * from '../../../packages/shared/src/utils/auth';
export * from '../../../packages/shared/src/utils/formatters';
export * from '../../../packages/shared/src/utils/rental-payment-status';
export * from '../../../packages/shared/src/constants/journal-references';
export * from '../../../packages/shared/src/utils/rental-order';
export * from '../../../packages/shared/src/utils/rental-inventory-pool';
export * from '../../../packages/shared/src/utils/cost-calculations';
export { asPartial } from '../../../packages/shared/src/utils/test-utils';
