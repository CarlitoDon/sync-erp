<<<<<<< HEAD
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
=======
>>>>>>> origin/dev
import {
  ArrowTopRightOnSquareIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { trpc } from '@/lib/trpc';
import {
  BILLING_PLANS,
  type BillingPlanKey,
  BILLING_USAGE_METRICS,
  type BillingPlan,
  type BillingUsageMetricKey,
  formatAnnualPlanPrice,
  formatBillingLimit,
  formatPlanPrice,
  getLimitUsagePercent,
<<<<<<< HEAD
  isBillingPlanKey,
  isLimitExceeded,
} from '@sync-erp/shared';
import {
  clearBillingPlanIntent,
  getBillingPlanIntent,
  setBillingPlanIntent,
} from '@/features/billing/planIntent';
=======
  isLimitExceeded,
} from '@sync-erp/shared';
>>>>>>> origin/dev

const usageMetricKeys: BillingUsageMetricKey[] = [
  'companies',
  'users',
  'products',
  'monthlyDocuments',
  'apiKeys',
];

<<<<<<< HEAD
const checkoutStatusCopy: Record<
  string,
  { title: string; body: string; tone: string }
> = {
  success: {
    title: 'Payment confirmation received',
    body: 'We are refreshing your billing status. If the provider webhook is delayed, this page will update after the webhook is processed.',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  pending: {
    title: 'Payment is still pending',
    body: 'Your checkout is open or waiting for provider confirmation. Keep this page and check again after payment is completed.',
    tone: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  failed: {
    title: 'Payment failed',
    body: 'The provider reported a failed payment. You can retry checkout or contact sales if the charge actually succeeded.',
    tone: 'border-red-200 bg-red-50 text-red-800',
  },
  cancelled: {
    title: 'Checkout cancelled',
    body: 'No plan change was applied. You can restart checkout whenever you are ready.',
    tone: 'border-gray-200 bg-gray-50 text-gray-700',
  },
};

=======
>>>>>>> origin/dev
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
  onSelectPlan,
  isSubmitting,
}: {
  plan: BillingPlan;
  isCurrent: boolean;
  onSelectPlan: (planKey: BillingPlanKey) => void;
  isSubmitting: boolean;
}) {
<<<<<<< HEAD
  const hasSelfServeCheckout =
    plan.monthlyPriceIdr !== null && plan.monthlyPriceIdr > 0;
  const isSelectionDisabled =
    isCurrent || isSubmitting || !hasSelfServeCheckout;
  let actionLabel = `Choose ${plan.name}`;

  if (isCurrent) {
    actionLabel = 'Current plan';
  } else if (!hasSelfServeCheckout) {
    actionLabel =
      plan.monthlyPriceIdr === 0 ? 'Default free plan' : 'Contact sales';
  } else if (isSubmitting) {
    actionLabel = 'Opening checkout...';
  }

=======
>>>>>>> origin/dev
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

<<<<<<< HEAD
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold">
        <span
          className={`rounded-md px-3 py-2 ${
            plan.limits.mediaAccess
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {plan.limits.mediaAccess ? 'Media access' : 'No media'}
        </span>
        <span
          className={`rounded-md px-3 py-2 ${
            plan.limits.adsEnabled
              ? 'bg-amber-50 text-amber-700'
              : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {plan.limits.adsEnabled ? 'Ads enabled' : 'No ads'}
        </span>
      </div>

=======
>>>>>>> origin/dev
      <ul className="mt-5 space-y-2 text-sm text-gray-600">
        {plan.features.slice(0, 4).map((feature) => (
          <li key={feature} className="flex gap-2">
            <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-none text-emerald-600" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
<<<<<<< HEAD
        disabled={isSelectionDisabled}
        onClick={() => onSelectPlan(plan.key)}
        className={`mt-5 inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition ${
          isSelectionDisabled
=======
        disabled={isCurrent || isSubmitting}
        onClick={() => onSelectPlan(plan.key)}
        className={`mt-5 inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition ${
          isCurrent
>>>>>>> origin/dev
            ? 'cursor-not-allowed bg-gray-100 text-gray-400'
            : 'bg-primary-600 text-white hover:bg-primary-700'
        }`}
      >
<<<<<<< HEAD
        {actionLabel}
=======
        {isCurrent
          ? 'Current plan'
          : isSubmitting
            ? 'Opening checkout...'
            : `Choose ${plan.name}`}
>>>>>>> origin/dev
      </button>
    </article>
  );
}

export default function BillingPage() {
<<<<<<< HEAD
  const [searchParams] = useSearchParams();
  const { data, isLoading, refetch } =
    trpc.billing.getOverview.useQuery();
=======
  const { data, isLoading } = trpc.billing.getOverview.useQuery();
>>>>>>> origin/dev
  const checkoutMutation =
    trpc.billing.createCheckoutSession.useMutation({
      onSuccess(result) {
        if (result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
        }
      },
    });
  const currentPlan = data?.currentPlan;
  const usage = data?.usage;
<<<<<<< HEAD
  const checkoutStatus = searchParams.get('checkout');
  const checkoutCopy = checkoutStatus
    ? checkoutStatusCopy[checkoutStatus]
    : null;
  const intentPlanParam = searchParams.get('intentPlan');
  const intentPlanKey = isBillingPlanKey(intentPlanParam)
    ? intentPlanParam
    : getBillingPlanIntent();
  const intentPlan =
    intentPlanKey && intentPlanKey !== currentPlan?.key
      ? (data?.plans.length ? data.plans : BILLING_PLANS).find(
          (plan) => plan.key === intentPlanKey
        )
      : null;

  useEffect(() => {
    if (checkoutStatus === 'success') {
      clearBillingPlanIntent();
      void refetch();
    }
  }, [checkoutStatus, refetch]);

  const handlePlanSelect = (planKey: BillingPlanKey) => {
    setBillingPlanIntent(planKey);
    checkoutMutation.mutate({
      planKey,
      billingCycle: 'MONTHLY',
=======

  const handlePlanSelect = (planKey: BillingPlanKey) => {
    checkoutMutation.mutate({
      planKey,
      billingCycle: 'MONTHLY',
      successUrl:
        `${window.location.origin}/settings/billing?checkout=success`,
      cancelUrl:
        `${window.location.origin}/settings/billing?checkout=cancelled`,
>>>>>>> origin/dev
    });
  };

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
<<<<<<< HEAD
            Manage freemium plan, limits, and monthly usage for{' '}
=======
            Manage commercial plan, limits, and monthly usage for{' '}
>>>>>>> origin/dev
            {data.company?.name ?? 'this company'}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => handlePlanSelect('growth')}
            disabled={checkoutMutation.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-300"
          >
            Upgrade to Growth
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </button>
          <a
            href="mailto:sales@sync-erp.com?subject=Sync%20ERP%20billing%20upgrade"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            Contact sales
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </a>
        </div>
      </div>

<<<<<<< HEAD
      {checkoutCopy && (
        <div
          className={`rounded-lg border p-4 text-sm ${checkoutCopy.tone}`}
        >
          <p className="font-semibold">{checkoutCopy.title}</p>
          <p className="mt-1 leading-6">{checkoutCopy.body}</p>
        </div>
      )}

      {intentPlan && (
        <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold">
                Continue your {intentPlan.name} upgrade
              </p>
              <p className="mt-1 leading-6">
                You selected {intentPlan.name} from the public pricing
                page. Complete checkout to remove ads and unlock the
                plan limits.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handlePlanSelect(intentPlan.key)}
              disabled={checkoutMutation.isPending}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:bg-cyan-300"
            >
              Continue checkout
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

=======
>>>>>>> origin/dev
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
              <span className="text-gray-500">Current period ends</span>
              <span className="font-semibold text-gray-900">
                {formatDate(data.subscription?.currentPeriodEndsAt)}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-3">
              <span className="text-gray-500">Grace ends</span>
              <span className="font-semibold text-gray-900">
                {formatDate(data.subscription?.graceEndsAt)}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-3">
              <span className="text-gray-500">Monthly price</span>
              <span className="font-semibold text-gray-900">
                {formatPlanPrice(currentPlan)}
              </span>
            </div>
<<<<<<< HEAD
            <div className="flex justify-between border-t border-gray-100 pt-3">
              <span className="text-gray-500">Ads</span>
              <span className="font-semibold text-gray-900">
                {currentPlan.limits.adsEnabled ? 'Enabled' : 'Hidden'}
              </span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-3">
              <span className="text-gray-500">Media</span>
              <span className="font-semibold text-gray-900">
                {currentPlan.limits.mediaAccess
                  ? 'Available'
                  : 'Hidden'}
              </span>
            </div>
=======
>>>>>>> origin/dev
          </div>

          <div
            className={`mt-6 rounded-lg border p-4 text-sm ${
              data.paymentProvider.configured
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            <div className="flex gap-2">
              <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 flex-none" />
              <p>{data.paymentProvider.message}</p>
            </div>
          </div>
          {checkoutMutation.error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {checkoutMutation.error.message}
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
<<<<<<< HEAD
        <div className="grid gap-4 xl:grid-cols-5">
=======
        <div className="grid gap-4 xl:grid-cols-4">
>>>>>>> origin/dev
          {(data.plans.length ? data.plans : BILLING_PLANS).map(
            (plan) => (
              <PlanCard
                key={plan.key}
                plan={plan}
                isCurrent={plan.key === currentPlan.key}
                isSubmitting={checkoutMutation.isPending}
                onSelectPlan={handlePlanSelect}
              />
            )
          )}
        </div>
      </section>
    </div>
  );
}
