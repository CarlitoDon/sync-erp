export const BILLING_TRIAL_DAYS = 14;

export type BillingPlanKey =
  | 'starter'
  | 'growth'
  | 'scale'
  | 'enterprise';

export type BillingLimitValue = number | 'unlimited';

export type BillingUsageMetricKey =
  | 'companies'
  | 'users'
  | 'products'
  | 'monthlyDocuments'
  | 'apiKeys';

export interface BillingPlanLimits {
  companies: BillingLimitValue;
  users: BillingLimitValue;
  products: BillingLimitValue;
  monthlyDocuments: BillingLimitValue;
  apiKeys: BillingLimitValue;
  rental: boolean;
  whatsapp: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
}

export interface BillingPlan {
  key: BillingPlanKey;
  name: string;
  tagline: string;
  monthlyPriceIdr: number | null;
  annualPriceIdr: number | null;
  recommended: boolean;
  cta: string;
  description: string;
  limits: BillingPlanLimits;
  features: string[];
  exclusions: string[];
}

export const BILLING_USAGE_METRICS: Record<
  BillingUsageMetricKey,
  { label: string; description: string }
> = {
  companies: {
    label: 'Companies',
    description: 'Legal entities or business units under one account.',
  },
  users: {
    label: 'Users',
    description: 'Team members who can sign in to a company workspace.',
  },
  products: {
    label: 'Products / SKUs',
    description: 'Inventory products, service items, and rental products.',
  },
  monthlyDocuments: {
    label: 'Documents / month',
    description:
      'Sales orders, purchase orders, invoices, bills, payments, and rental orders created this month.',
  },
  apiKeys: {
    label: 'API keys',
    description: 'Active integration keys for external systems.',
  },
};

export const BILLING_PLANS: readonly BillingPlan[] = [
  {
    key: 'starter',
    name: 'Starter',
    tagline: 'Untuk bisnis kecil yang mulai menata operasi.',
    monthlyPriceIdr: 499_000,
    annualPriceIdr: 4_990_000,
    recommended: false,
    cta: 'Mulai Starter',
    description:
      'Core ERP untuk sales, purchasing, inventory, dan finance dasar.',
    limits: {
      companies: 1,
      users: 3,
      products: 500,
      monthlyDocuments: 750,
      apiKeys: 0,
      rental: false,
      whatsapp: false,
      apiAccess: false,
      prioritySupport: false,
    },
    features: [
      'Sales order, purchase order, invoice, bill, dan payment',
      'Inventory product, stock movement, receipt, dan shipment',
      'Cash & bank, expense, journal, dan ledger dasar',
      'Email support dengan response target 2 hari kerja',
    ],
    exclusions: [
      'Rental operations',
      'WhatsApp integration',
      'API key dan webhook',
    ],
  },
  {
    key: 'growth',
    name: 'Growth',
    tagline: 'Untuk tim yang butuh rental, WhatsApp, dan integrasi awal.',
    monthlyPriceIdr: 1_299_000,
    annualPriceIdr: 12_990_000,
    recommended: true,
    cta: 'Pilih Growth',
    description:
      'ERP operasional lengkap untuk bisnis yang mulai scale lintas tim.',
    limits: {
      companies: 3,
      users: 12,
      products: 5_000,
      monthlyDocuments: 5_000,
      apiKeys: 3,
      rental: true,
      whatsapp: true,
      apiAccess: true,
      prioritySupport: false,
    },
    features: [
      'Semua fitur Starter',
      'Rental items, bundles, orders, returns, overdue, dan scheduler',
      'WhatsApp settings untuk komunikasi operasional',
      'API keys, webhook endpoint, dan integration marketplace',
      'Email support dengan response target 1 hari kerja',
    ],
    exclusions: ['Priority support SLA', 'Custom onboarding'],
  },
  {
    key: 'scale',
    name: 'Scale',
    tagline: 'Untuk perusahaan multi-cabang dengan volume tinggi.',
    monthlyPriceIdr: 3_499_000,
    annualPriceIdr: 34_990_000,
    recommended: false,
    cta: 'Upgrade ke Scale',
    description:
      'Limit besar, kontrol integrasi, dan support prioritas untuk operasi matang.',
    limits: {
      companies: 10,
      users: 40,
      products: 50_000,
      monthlyDocuments: 25_000,
      apiKeys: 15,
      rental: true,
      whatsapp: true,
      apiAccess: true,
      prioritySupport: true,
    },
    features: [
      'Semua fitur Growth',
      'Limit tinggi untuk dokumen bulanan dan katalog SKU besar',
      'Lebih banyak company workspace dan API key',
      'Priority support dengan response target 4 jam kerja',
      'Onboarding operasional 1 sesi',
    ],
    exclusions: ['Dedicated SLA contract', 'Custom enterprise terms'],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    tagline: 'Untuk kebutuhan custom, volume sangat besar, dan SLA khusus.',
    monthlyPriceIdr: null,
    annualPriceIdr: null,
    recommended: false,
    cta: 'Hubungi sales',
    description:
      'Kontrak khusus untuk deployment, security review, dan kebutuhan integrasi skala enterprise.',
    limits: {
      companies: 'unlimited',
      users: 'unlimited',
      products: 'unlimited',
      monthlyDocuments: 'unlimited',
      apiKeys: 'unlimited',
      rental: true,
      whatsapp: true,
      apiAccess: true,
      prioritySupport: true,
    },
    features: [
      'Semua fitur Scale',
      'Custom limit, custom onboarding, dan success plan',
      'Security review dan support procurement/vendor paperwork',
      'Dedicated SLA contract',
      'Custom integration planning',
    ],
    exclusions: [],
  },
] as const;

export const DEFAULT_BILLING_PLAN_KEY: BillingPlanKey = 'starter';

export function getBillingPlan(
  key: BillingPlanKey = DEFAULT_BILLING_PLAN_KEY
): BillingPlan {
  return (
    BILLING_PLANS.find((plan) => plan.key === key) ||
    BILLING_PLANS[0]
  );
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatBillingLimit(value: BillingLimitValue): string {
  return value === 'unlimited'
    ? 'Unlimited'
    : new Intl.NumberFormat('id-ID').format(value);
}

export function formatPlanPrice(plan: BillingPlan): string {
  if (plan.monthlyPriceIdr === null) {
    return 'Custom';
  }

  return `${formatRupiah(plan.monthlyPriceIdr)}/bulan`;
}

export function formatAnnualPlanPrice(plan: BillingPlan): string {
  if (plan.annualPriceIdr === null) {
    return 'Custom contract';
  }

  return `${formatRupiah(plan.annualPriceIdr)}/tahun`;
}

export function isLimitExceeded(
  limit: BillingLimitValue,
  usage: number
): boolean {
  return limit !== 'unlimited' && usage > limit;
}

export function getLimitUsagePercent(
  limit: BillingLimitValue,
  usage: number
): number {
  if (limit === 'unlimited') {
    return 0;
  }

  if (limit <= 0) {
    return usage > 0 ? 100 : 0;
  }

  return Math.min(Math.round((usage / limit) * 100), 100);
}
