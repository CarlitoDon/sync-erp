import { useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import type {
  OnboardingStep,
  OnboardingProgress,
} from '@/features/dashboard/types';
import type { DashboardMetrics } from '@/types/api';

// Step configurations
const ONBOARDING_STEPS_CONFIG: Omit<OnboardingStep, 'isCompleted'>[] =
  [
    {
      id: 'create-company',
      title: 'Create your first company',
      description:
        'A company is your business entity. All data like products, orders, and finances are organized per company.',
      targetPath: '/companies',
      icon: '🏢',
    },
    {
      id: 'add-products',
      title: 'Add products and services',
      description:
        'Products are items you sell or purchase. Add your inventory to start creating orders.',
      targetPath: '/products',
      icon: '📦',
    },
    {
      id: 'setup-suppliers',
      title: 'Set up suppliers',
      description:
        'Suppliers are vendors you buy from. Add them to create purchase orders and track payables.',
      targetPath: '/suppliers',
      icon: '🏭',
    },
    {
      id: 'setup-customers',
      title: 'Set up customers',
      description:
        'Customers are people or businesses you sell to. Add them to create invoices and track receivables.',
      targetPath: '/customers',
      icon: '👥',
    },
    {
      id: 'create-order',
      title: 'Create your first order',
      description:
        'Orders track what you are buying or selling. Start with a sales order to record your first sale.',
      targetPath: '/sales-orders',
      icon: '📋',
    },
    {
      id: 'setup-accounts',
      title: 'Set up chart of accounts',
      description:
        'Chart of accounts organizes your finances into categories like assets, liabilities, and expenses.',
      targetPath: '/finance',
      icon: '💰',
    },
  ];

interface UseOnboardingProgressResult extends OnboardingProgress {
  loading: boolean;
  error: Error | null;
}

export function useOnboardingProgress(
  metrics: DashboardMetrics | null
): UseOnboardingProgressResult {
  // Fetch additional data using tRPC hooks
  const { data: suppliers = [], isLoading: loadingSuppliers } =
    trpc.partner.list.useQuery({ type: 'SUPPLIER' });
  const { data: customers = [], isLoading: loadingCustomers } =
    trpc.partner.list.useQuery({ type: 'CUSTOMER' });
  const { data: accounts = [], isLoading: loadingAccounts } =
    trpc.finance.listAccounts.useQuery();

  const loading =
    loadingSuppliers || loadingCustomers || loadingAccounts;

  const additionalData = {
    suppliersCount: suppliers.length,
    customersCount: customers.length,
    accountsCount: accounts.length,
    loading,
    error: null, // tRPC handles errors, but for now simplified
  };

  // Calculate step completion status
  const progress = useMemo((): OnboardingProgress => {
    const steps: OnboardingStep[] = ONBOARDING_STEPS_CONFIG.map(
      (step) => {
        let isCompleted = false;

        switch (step.id) {
          case 'create-company':
            // Always true if user is on dashboard (has selected company)
            isCompleted = true;
            break;
          case 'add-products':
            isCompleted = (metrics?.productsCount || 0) > 0;
            break;
          case 'setup-suppliers':
            isCompleted = additionalData.suppliersCount > 0;
            break;
          case 'setup-customers':
            isCompleted = additionalData.customersCount > 0;
            break;
          case 'create-order':
            isCompleted = (metrics?.totalOrders || 0) > 0;
            break;
          case 'setup-accounts':
            isCompleted = additionalData.accountsCount > 0;
            break;
        }

        return { ...step, isCompleted };
      }
    );

    const completedCount = steps.filter((s) => s.isCompleted).length;
    const totalCount = steps.length;

    return {
      steps,
      completedCount,
      totalCount,
      isAllComplete: completedCount === totalCount,
      percentComplete: Math.round(
        (completedCount / totalCount) * 100
      ),
    };
  }, [metrics, additionalData]);

  return {
    ...progress,
    loading: additionalData.loading,
    error: additionalData.error,
  };
}
