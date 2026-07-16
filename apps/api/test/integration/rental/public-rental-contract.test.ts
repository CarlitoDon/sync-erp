import { describe, expect, it } from 'vitest';
import { appRouter } from '@src/trpc/router';
<<<<<<< HEAD
import { integrationV1Router } from '@src/trpc/routers/integration-v1.router';
=======
>>>>>>> origin/dev
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

<<<<<<< HEAD
  const expectedIntegrationV1Procedures = [
    'rental.customers.create',
    'rental.orders.create',
    'rental.orders.get',
    'rental.orders.getByToken',
    'rental.orders.getByOrderNumber',
    'rental.orders.update',
    'rental.orders.cancel',
    'rental.payments.claim',
    'rental.payments.confirm',
    'rental.payments.reject',
  ].sort();

  it('exposes expected publicRental procedures', () => {
    const procedureKeys = Object.keys(publicRentalRouter._def.procedures).sort();
=======
  it('exposes expected publicRental procedures', () => {
    const procedureKeys = Object.keys(
      publicRentalRouter._def.procedures
    ).sort();
>>>>>>> origin/dev
    expect(procedureKeys).toEqual(expectedProcedures);
  });

  it('maps appRouter publicRental to the same procedure surface', () => {
    const appProcedures = Object.keys(appRouter._def.procedures)
      .filter((key) => key.startsWith('publicRental.'))
      .map((key) => key.replace('publicRental.', ''))
      .sort();
<<<<<<< HEAD
    const facadeProcedures = Object.keys(publicRentalRouter._def.procedures).sort();
=======
    const facadeProcedures = Object.keys(
      publicRentalRouter._def.procedures
    ).sort();
>>>>>>> origin/dev

    expect(appProcedures).toEqual(expectedProcedures);
    expect(facadeProcedures).toEqual(expectedProcedures);
  });
<<<<<<< HEAD

  it('exposes the generic integrationV1 rental procedure surface', () => {
    const procedureKeys = Object.keys(
      integrationV1Router._def.procedures
    ).sort();

    expect(procedureKeys).toEqual(expectedIntegrationV1Procedures);
  });

  it('maps appRouter integrationV1 to the same procedure surface', () => {
    const appProcedures = Object.keys(appRouter._def.procedures)
      .filter((key) => key.startsWith('integrationV1.'))
      .map((key) => key.replace('integrationV1.', ''))
      .sort();

    expect(appProcedures).toEqual(expectedIntegrationV1Procedures);
  });
=======
>>>>>>> origin/dev
});
