import {
  ArrowTopRightOnSquareIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { trpc } from '@/lib/trpc';
import {
  BILLING_PLANS,
  BILLING_USAGE_METRICS,
  type BillingPlan,
  type BillingUsageMetricKey,
  formatAnnualPlanPrice,
  formatBillingLimit,
  formatPlanPrice,
  getLimitUsagePercent,
  isLimitExceeded,
} from '@sync-erp/shared';

const usageMetricKeys: BillingUsageMetricKey[] = [
  'companies',
  'users',
  'products',
  'monthlyDocuments',
  'apiKeys',
];

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

function PlanCard({
  plan,
  isCurrent,
}: {
  plan: BillingPlan;
  isCurrent: boolean;
}) {
  return (
    <article
      className={`rounded-lg border bg-white p-5 shadow-sm ${
        plan.recommended
          ? 'border-primary-300 ring-2 ring-primary-100'
          : 'border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-950">
              {plan.name}
            </h3>
            {isCurrent && (
              <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                Current
              </span>
            )}
          </div>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            {plan.tagline}
          </p>
        </div>
        {plan.recommended && (
          <span className="rounded-md bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">
            Recommended
          </span>
        )}
      </div>

      <div className="mt-5">
        <p className="text-3xl font-semibold text-gray-950">
          {formatPlanPrice(plan)}
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Annual: {formatAnnualPlanPrice(plan)}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-md bg-gray-50 p-3">
          <p className="text-gray-500">Users</p>
          <p className="font-semibold text-gray-900">
            {formatBillingLimit(plan.limits.users)}
          </p>
        </div>
        <div className="rounded-md bg-gray-50 p-3">
          <p className="text-gray-500">Docs / month</p>
          <p className="font-semibold text-gray-900">
            {formatBillingLimit(plan.limits.monthlyDocuments)}
          </p>
        </div>
      </div>

      <ul className="mt-5 space-y-2 text-sm text-gray-600">
        {plan.features.slice(0, 4).map((feature) => (
          <li key={feature} className="flex gap-2">
            <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-none text-emerald-600" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export default function BillingPage() {
  const { data, isLoading } = trpc.billing.getOverview.useQuery();
  const currentPlan = data?.currentPlan;
  const usage = data?.usage;

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        Loading billing overview...
      </div>
    );
  }

  if (!data || !currentPlan || !usage) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Billing overview is unavailable for this workspace.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-950">
            Billing & Plan
          </h1>
          <p className="mt-1 text-gray-500">
            Manage commercial plan, limits, and monthly usage for{' '}
            {data.company?.name ?? 'this company'}.
          </p>
        </div>
        <a
          href="mailto:sales@sync-erp.com?subject=Sync%20ERP%20billing%20upgrade"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
        >
          Contact sales
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
        </a>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary-50 p-3 text-primary-700">
              <BanknotesIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Current plan</p>
              <h2 className="text-xl font-semibold text-gray-950">
                {currentPlan.name}
              </h2>
            </div>
          </div>

          <div className="mt-6 grid gap-3 text-sm">
            <div className="flex justify-between border-t border-gray-100 pt-3">
              <span className="text-gray-500">Status</span>
              <span className="font-semibold text-emerald-700">
                {data.status === 'trialing' ? 'Trialing' : data.status}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-3">
              <span className="text-gray-500">Trial ends</span>
              <span className="font-semibold text-gray-900">
                {formatDate(data.trialEndsAt)}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-3">
              <span className="text-gray-500">Monthly price</span>
              <span className="font-semibold text-gray-900">
                {formatPlanPrice(currentPlan)}
              </span>
            </div>
          </div>

          {!data.paymentProvider.configured && (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <div className="flex gap-2">
                <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-none" />
                <p>{data.paymentProvider.message}</p>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-950">
            Usage against limits
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Current usage is calculated from live workspace records.
          </p>

          <div className="mt-5 space-y-4">
            {usageMetricKeys.map((key) => {
              const limit = currentPlan.limits[key];
              const used = usage[key];
              const percent = getLimitUsagePercent(limit, used);
              const exceeded = isLimitExceeded(limit, used);
              const metric = BILLING_USAGE_METRICS[key];

              return (
                <div key={key}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {metric.label}
                      </p>
                      <p className="text-xs leading-5 text-gray-500">
                        {metric.description}
                      </p>
                    </div>
                    <p
                      className={`text-sm font-semibold ${
                        exceeded ? 'text-red-700' : 'text-gray-900'
                      }`}
                    >
                      {formatBillingLimit(used)} /{' '}
                      {formatBillingLimit(limit)}
                    </p>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-gray-100">
                    <div
                      className={`h-2 rounded-full ${
                        exceeded ? 'bg-red-500' : 'bg-primary-500'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-950">
            Available plans
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Pricing is IDR, excludes tax, and can be billed monthly or annually.
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-4">
          {(data.plans.length ? data.plans : BILLING_PLANS).map(
            (plan) => (
              <PlanCard
                key={plan.key}
                plan={plan}
                isCurrent={plan.key === currentPlan.key}
              />
            )
          )}
        </div>
      </section>
    </div>
  );
}
