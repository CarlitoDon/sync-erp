/**
 * Public Rental Router (Facade)
 *
 * Composes sub-routers for partner, order, and payment management.
 * This router is used by external clients (santi-living erp-sync-service).
 *
 * Sub-routers:
 * - Partner: findOrCreatePartner
 * - Order: getByToken, createOrder, deleteOrder
 * - Payment: updatePaymentMethod, confirmPayment, confirmPaymentByOrderNumber
 */

import { router } from '../trpc';
import { publicRentalPartnerRouter } from './public-rental/public-rental-partner.router';
import { publicRentalOrderRouter } from './public-rental/public-rental-order.router';
import { publicRentalPaymentRouter } from './public-rental/public-rental-payment.router';

export const publicRentalRouter = router({
  // Partner management
  ...publicRentalPartnerRouter._def.procedures,

  // Order lifecycle (create, get, delete)
  ...publicRentalOrderRouter._def.procedures,

  // Payment operations
  ...publicRentalPaymentRouter._def.procedures,
});

export type PublicRentalRouter = typeof publicRentalRouter;
