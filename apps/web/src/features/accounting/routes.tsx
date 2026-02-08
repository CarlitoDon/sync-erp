import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { LazyRoute } from '@/app/LazyRoute';

// Accounting pages - lazy loaded
const Finance = lazy(() => import('./pages/Finance'));
const Invoices = lazy(() => import('./pages/Invoices'));
const InvoiceDetail = lazy(() => import('./pages/InvoiceDetail'));
const AccountsPayable = lazy(() => import('./pages/AccountsPayable'));
const BillDetail = lazy(() => import('./components/BillDetail'));
const Payments = lazy(() => import('./pages/Payments'));
const PaymentDetail = lazy(() => import('./pages/PaymentDetail'));
const ExpenseList = lazy(() => import('./pages/ExpenseList'));
const ExpenseDetail = lazy(() => import('./pages/ExpenseDetail'));
const JournalEntries = lazy(() => import('./pages/JournalEntries'));
const JournalDetail = lazy(() => import('./pages/JournalDetail'));

export const AccountingRoutes = (
  <>
    <Route
      path="finance"
      element={
        <LazyRoute>
          <Finance />
        </LazyRoute>
      }
    />
    <Route
      path="invoices"
      element={
        <LazyRoute>
          <Invoices />
        </LazyRoute>
      }
    />
    <Route
      path="invoices/:id"
      element={
        <LazyRoute>
          <InvoiceDetail />
        </LazyRoute>
      }
    />
    <Route
      path="expenses"
      element={
        <LazyRoute>
          <ExpenseList />
        </LazyRoute>
      }
    />
    <Route
      path="expenses/:id"
      element={
        <LazyRoute>
          <ExpenseDetail />
        </LazyRoute>
      }
    />
    <Route
      path="bills"
      element={
        <LazyRoute>
          <AccountsPayable />
        </LazyRoute>
      }
    />
    <Route
      path="bills/:id"
      element={
        <LazyRoute>
          <BillDetail />
        </LazyRoute>
      }
    />
    <Route
      path="payments"
      element={
        <LazyRoute>
          <Payments />
        </LazyRoute>
      }
    />
    <Route
      path="payments/:id"
      element={
        <LazyRoute>
          <PaymentDetail />
        </LazyRoute>
      }
    />
    <Route
      path="journals"
      element={
        <LazyRoute>
          <JournalEntries />
        </LazyRoute>
      }
    />
    <Route
      path="journals/:id"
      element={
        <LazyRoute>
          <JournalDetail />
        </LazyRoute>
      }
    />
  </>
);
