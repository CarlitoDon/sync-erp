import { describe, expect, it } from 'vitest';
import { appRouter } from '@src/trpc/router';
import { publicRentalRouter } from '@src/trpc/routers/public-rental.router';

describe('Public Rental Contract', () => {
  const expectedProcedures = [
    'getByToken',
    'findOrCreatePartner',
    'createOrder',
    'updateOrder',
    'deleteOrder',
    'confirmPayment',
    'updatePaymentMethod',
    'confirmPaymentByOrderNumber',
    'rejectPaymentByOrderNumber',
  ].sort();

  it('exposes expected publicRental procedures', () => {
    const procedureKeys = Object.keys(publicRentalRouter._def.procedures).sort();
    expect(procedureKeys).toEqual(expectedProcedures);
  });

  it('maps appRouter publicRental to the same procedure surface', () => {
    const appProcedures = Object.keys(appRouter._def.procedures)
      .filter((key) => key.startsWith('publicRental.'))
      .map((key) => key.replace('publicRental.', ''))
      .sort();
    const facadeProcedures = Object.keys(publicRentalRouter._def.procedures).sort();

    expect(appProcedures).toEqual(expectedProcedures);
    expect(facadeProcedures).toEqual(expectedProcedures);
  });
});
