import { useEffect } from 'react';
import type { ComponentType, SVGProps } from 'react';
import {
  ArrowPathIcon,
  ArrowRightIcon,
  ArrowRightOnRectangleIcon,
  BanknotesIcon,
  BuildingOffice2Icon,
  ChartBarSquareIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  CloudArrowUpIcon,
  Cog6ToothIcon,
  CubeIcon,
  DocumentCheckIcon,
  LockClosedIcon,
  ServerStackIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  SparklesIcon,
  TruckIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import {
  BILLING_PLANS,
  BILLING_TRIAL_DAYS,
  type BillingPlan,
  formatBillingLimit,
<<<<<<< HEAD
=======
  formatPlanPrice,
>>>>>>> origin/dev
} from '@sync-erp/shared';

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

interface ModuleItem {
  title: string;
  description: string;
  icon: IconType;
  accent: string;
}

interface WorkflowItem {
  title: string;
  steps: string[];
  icon: IconType;
}

const navigation = [
  { label: 'Platform', href: '#platform' },
<<<<<<< HEAD
  { label: 'AI ERP', href: '#ai-erp' },
=======
>>>>>>> origin/dev
  { label: 'Modul', href: '#modules' },
  { label: 'Harga', href: '#pricing' },
  { label: 'Alur kerja', href: '#workflows' },
  { label: 'Keamanan', href: '#security' },
];

const proofPoints = [
<<<<<<< HEAD
  'Free untuk 1 company',
  'AI-ready command center',
  'Multi-company',
  'Sales sampai finance',
=======
  'Multi-company',
  'Sales sampai finance',
  'Inventory real-time',
  'API dan WhatsApp-ready',
>>>>>>> origin/dev
];

const heroStats = [
  {
    value: '1',
    label: 'database operasional untuk semua divisi',
  },
  {
    value: '7+',
    label: 'modul inti yang saling tersambung',
  },
  {
    value: '24/7',
    label: 'kontrol proses bisnis dari cloud',
  },
];

const modules: ModuleItem[] = [
  {
    title: 'Sales & Customer',
    description:
      'Kelola pelanggan, quotation, sales order, invoice, dan pembayaran dalam satu alur yang rapi.',
    icon: ShoppingCartIcon,
    accent: 'bg-sky-50 text-sky-700 border-sky-100',
  },
  {
    title: 'Procurement',
    description:
      'Pantau supplier, purchase order, goods receipt, bill, dan pembayaran vendor tanpa data tercecer.',
    icon: TruckIcon,
    accent: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  },
  {
    title: 'Inventory',
    description:
      'Stok, produk, pergerakan barang, penerimaan, dan pengiriman tersambung langsung ke transaksi.',
    icon: CubeIcon,
    accent: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  },
  {
    title: 'Finance',
    description:
      'Invoice, bill, payment, cash bank, expense, journal, dan ledger siap untuk kontrol keuangan harian.',
    icon: BanknotesIcon,
    accent: 'bg-amber-50 text-amber-700 border-amber-100',
  },
  {
    title: 'Rental Operations',
    description:
      'Kelola item, bundle, order rental, return, overdue, scheduler, dan setting operasional sewa.',
    icon: ClipboardDocumentCheckIcon,
    accent: 'bg-rose-50 text-rose-700 border-rose-100',
  },
  {
    title: 'Integrasi & Admin',
    description:
      'Multi-company, team, payment method, API docs, dan WhatsApp integration untuk operasional modern.',
    icon: Cog6ToothIcon,
    accent: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  },
];

const workflows: WorkflowItem[] = [
  {
    title: 'Order-to-cash',
    steps: ['Customer', 'Quotation', 'Sales order', 'Shipment', 'Invoice'],
    icon: ChartBarSquareIcon,
  },
  {
    title: 'Procure-to-pay',
    steps: ['Supplier', 'Purchase order', 'Receipt', 'Vendor bill', 'Payment'],
    icon: DocumentCheckIcon,
  },
  {
    title: 'Rental lifecycle',
    steps: ['Bundle', 'Booking', 'Schedule', 'Return', 'Overdue control'],
    icon: ArrowPathIcon,
  },
];

const operationsRows = [
  {
    label: 'SO-1048',
    team: 'Sales',
    amount: 'Rp 84.2M',
    status: 'Ready to ship',
    tone: 'bg-sky-500',
  },
  {
    label: 'PO-8812',
    team: 'Procurement',
    amount: 'Rp 37.6M',
    status: 'Receipt pending',
    tone: 'bg-emerald-500',
  },
  {
    label: 'INV-2219',
    team: 'Finance',
    amount: 'Rp 18.9M',
    status: 'Payment review',
    tone: 'bg-amber-500',
  },
];

const pipeline = [
  { label: 'Sales', value: '74%' },
  { label: 'Stock', value: '61%' },
  { label: 'Cash flow', value: '82%' },
];

<<<<<<< HEAD
const APP_ORIGIN = 'https://sync-erp.vercel.app';
=======
const APP_ORIGIN = 'https://sync-erp-app.vercel.app';
>>>>>>> origin/dev

function getAppHref(path: string) {
  if (typeof window === 'undefined') {
    return path;
  }

  const { hostname } = window.location;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  return isLocalhost ? path : `${APP_ORIGIN}${path}`;
}

<<<<<<< HEAD
function formatMarketingPrice(plan: BillingPlan): {
  price: string;
  suffix: string;
} {
  if (plan.monthlyPriceIdr === null) {
    return { price: 'Custom', suffix: 'SLA & scope khusus' };
  }

  if (plan.monthlyPriceIdr === 0) {
    return { price: 'Gratis', suffix: 'untuk 1 company' };
  }

  if (plan.monthlyPriceIdr >= 1_000_000) {
    const value = plan.monthlyPriceIdr / 1_000_000;
    const formatted = new Intl.NumberFormat('id-ID', {
      maximumFractionDigits: 2,
    }).format(value);

    return { price: `Rp ${formatted}jt`, suffix: '/ bulan' };
  }

  const value = plan.monthlyPriceIdr / 1_000;
  const formatted = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(value);

  return { price: `Rp ${formatted}rb`, suffix: '/ bulan' };
}

=======
>>>>>>> origin/dev
function BrandMark() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white shadow-sm">
      S
    </span>
  );
}

function SectionEyebrow({
  icon: Icon,
  children,
}: {
  icon: IconType;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm">
      <Icon className="h-4 w-4 text-cyan-700" />
      {children}
    </div>
  );
}

function DashboardPreview({ className = '' }: { className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-300/50 ${className}`}
      aria-label="Sync ERP operations dashboard preview"
    >
      <div className="flex h-11 items-center justify-between border-b border-slate-200 bg-slate-50 px-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </div>
        <div className="hidden items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 sm:flex">
          <ShieldCheckIcon className="h-4 w-4 text-emerald-600" />
          Live company workspace
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[0.85fr_1.35fr]">
        <aside className="border-b border-slate-200 bg-slate-950 p-5 text-white lg:border-b-0 lg:border-r lg:border-slate-800">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <p className="text-sm font-semibold">Sync ERP</p>
              <p className="text-xs text-slate-400">Operations cockpit</p>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            {['Dashboard', 'Sales', 'Inventory', 'Finance'].map((item) => (
              <div
                key={item}
                className="flex items-center justify-between rounded-md bg-white/[0.08] px-3 py-2 text-sm"
              >
                <span>{item}</span>
                <span className="h-2 w-2 rounded-full bg-cyan-300" />
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.08] p-4">
            <p className="text-xs uppercase text-slate-400">Today focus</p>
            <p className="mt-2 text-2xl font-semibold">31 tasks</p>
            <p className="mt-1 text-sm text-slate-300">
              Sales, stock, finance, and rental follow-ups.
            </p>
          </div>
        </aside>

        <div className="bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Multi-company overview
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                Operasi hari ini
              </h2>
            </div>
            <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              Healthy cash cycle
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {pipeline.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <p className="text-xs font-medium text-slate-500">
                  {item.label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {item.value}
                </p>
                <div className="mt-3 h-2 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-cyan-500"
                    style={{ width: item.value }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-slate-200">
            <div className="grid grid-cols-[0.85fr_0.8fr_0.75fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500 sm:grid-cols-[0.8fr_0.7fr_0.75fr_1fr]">
              <span>Doc</span>
              <span>Team</span>
              <span>Value</span>
              <span className="hidden sm:block">Status</span>
            </div>
            {operationsRows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[0.85fr_0.8fr_0.75fr] items-center border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 sm:grid-cols-[0.8fr_0.7fr_0.75fr_1fr]"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${row.tone}`} />
                  <span className="truncate font-medium text-slate-950">
                    {row.label}
                  </span>
                </div>
                <span className="truncate text-slate-600">{row.team}</span>
                <span className="truncate font-medium text-slate-800">
                  {row.amount}
                </span>
                <span className="hidden truncate text-slate-500 sm:block">
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(14,165,233,0.16),transparent_30%),radial-gradient(circle_at_90%_8%,rgba(16,185,129,0.15),transparent_34%),linear-gradient(135deg,#ffffff_0%,#f8fafc_52%,#ecfeff_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)] bg-[size:56px_56px]" />
    </div>
  );
}

function PricingCard({ plan }: { plan: BillingPlan }) {
  const ctaHref =
    plan.key === 'enterprise'
      ? 'mailto:sales@sync-erp.com?subject=Sync%20ERP%20Enterprise'
      : getAppHref(`/register?plan=${plan.key}`);
<<<<<<< HEAD
  const pricing = formatMarketingPrice(plan);
  const highlightedFeatures = plan.features.slice(0, 3);

  return (
    <article
      className={`flex h-full min-h-[35rem] flex-col rounded-3xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${
        plan.recommended
          ? 'border-cyan-300 shadow-cyan-100/80 ring-2 ring-cyan-100'
          : 'border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold text-slate-950">
            {plan.name}
          </h3>
          <p className="mt-2 min-h-[3.5rem] text-sm leading-6 text-slate-600">
=======

  return (
    <article
      className={`rounded-lg border bg-white p-6 shadow-sm ${
        plan.recommended
          ? 'border-cyan-300 ring-2 ring-cyan-100'
          : 'border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-950">
            {plan.name}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
>>>>>>> origin/dev
            {plan.tagline}
          </p>
        </div>
        {plan.recommended && (
<<<<<<< HEAD
          <span className="shrink-0 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700 ring-1 ring-cyan-100">
=======
          <span className="rounded-md bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">
>>>>>>> origin/dev
            Paling pas
          </span>
        )}
      </div>

<<<<<<< HEAD
      <div className="mt-6 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
        <div className="flex items-end gap-2">
          <p className="text-3xl font-semibold tracking-tight text-slate-950">
            {pricing.price}
          </p>
          <p className="pb-1 text-sm font-medium text-slate-500">
            {pricing.suffix}
          </p>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
=======
      <div className="mt-6">
        <p className="text-3xl font-semibold text-slate-950">
          {formatPlanPrice(plan)}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
>>>>>>> origin/dev
          {plan.description}
        </p>
      </div>

<<<<<<< HEAD
      <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-2xl border border-slate-100 bg-white p-3">
          <p className="text-xs text-slate-500">Users</p>
          <p className="mt-1 font-semibold text-slate-950">
            {formatBillingLimit(plan.limits.users)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-3">
          <p className="text-xs text-slate-500">Docs/bulan</p>
          <p className="mt-1 font-semibold text-slate-950">
            {formatBillingLimit(plan.limits.monthlyDocuments)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-3">
          <p className="text-xs text-slate-500">Company</p>
          <p className="mt-1 font-semibold text-slate-950">
            {formatBillingLimit(plan.limits.companies)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-3">
          <p className="text-xs text-slate-500">API keys</p>
          <p className="mt-1 font-semibold text-slate-950">
=======
      <div className="mt-6 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-md bg-slate-50 p-3">
          <p className="text-slate-500">Users</p>
          <p className="font-semibold text-slate-900">
            {formatBillingLimit(plan.limits.users)}
          </p>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <p className="text-slate-500">Docs / bulan</p>
          <p className="font-semibold text-slate-900">
            {formatBillingLimit(plan.limits.monthlyDocuments)}
          </p>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <p className="text-slate-500">Companies</p>
          <p className="font-semibold text-slate-900">
            {formatBillingLimit(plan.limits.companies)}
          </p>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <p className="text-slate-500">API keys</p>
          <p className="font-semibold text-slate-900">
>>>>>>> origin/dev
            {formatBillingLimit(plan.limits.apiKeys)}
          </p>
        </div>
      </div>

<<<<<<< HEAD
      <ul className="mt-6 flex-1 space-y-3 text-sm leading-6 text-slate-600">
        <li className="flex gap-2">
          <CheckCircleIcon className="mt-1 h-4 w-4 flex-none text-emerald-600" />
          <span>{plan.limits.adsEnabled ? 'Didukung iklan' : 'Tanpa iklan'}</span>
        </li>
        <li className="flex gap-2">
          <CheckCircleIcon className="mt-1 h-4 w-4 flex-none text-emerald-600" />
          <span>
            {plan.limits.mediaAccess
              ? 'Media upload aktif'
              : 'Tanpa akses media'}
          </span>
        </li>
        {highlightedFeatures.map((feature) => (
          <li key={feature} className="flex gap-2">
            <CheckCircleIcon className="mt-1 h-4 w-4 flex-none text-emerald-600" />
=======
      <ul className="mt-6 space-y-3 text-sm text-slate-600">
        {plan.features.slice(0, 5).map((feature) => (
          <li key={feature} className="flex gap-2">
            <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-none text-emerald-600" />
>>>>>>> origin/dev
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <a
        href={ctaHref}
<<<<<<< HEAD
        className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
          plan.recommended
            ? 'bg-slate-950 text-white shadow-lg shadow-slate-950/15 hover:bg-slate-800'
=======
        className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold transition ${
          plan.recommended
            ? 'bg-slate-950 text-white hover:bg-slate-800'
>>>>>>> origin/dev
            : 'border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50'
        }`}
      >
        {plan.cta}
        <ArrowRightIcon className="h-4 w-4" />
      </a>
    </article>
  );
}

export default function MarketingHomePage() {
  const loginHref = getAppHref('/login');
  const registerHref = getAppHref('/register');

  useEffect(() => {
    const previousTitle = document.title;
    const description = document.querySelector(
      'meta[name="description"]'
    );
    const previousDescription = description?.getAttribute('content');

    document.title =
      'Sync ERP | ERP multi-company untuk operasi bisnis modern';
    description?.setAttribute(
      'content',
      'Sync ERP adalah platform ERP multi-company untuk sales, procurement, inventory, rental, finance, API, dan WhatsApp integration.'
    );

    return () => {
      document.title = previousTitle;
      if (previousDescription) {
        description?.setAttribute('content', previousDescription);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-3">
            <BrandMark />
            <span className="text-base font-semibold text-slate-950">
              Sync ERP
            </span>
          </a>

          <nav
            className="hidden items-center gap-7 text-sm font-medium text-slate-600 lg:flex"
            aria-label="Marketing navigation"
          >
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="transition hover:text-slate-950"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={loginHref}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              Masuk
            </a>
            <a
              href={registerHref}
              className="hidden items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 sm:inline-flex"
            >
              Mulai
              <ArrowRightIcon className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden border-b border-slate-200">
          <HeroBackdrop />
<<<<<<< HEAD
          <div className="relative mx-auto grid min-h-[86svh] max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(28rem,1.1fr)] lg:gap-14 lg:px-8">
            <div className="min-w-0">
=======
          <div className="relative mx-auto flex min-h-[86svh] max-w-7xl flex-col justify-center px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="max-w-3xl lg:max-w-2xl">
>>>>>>> origin/dev
              <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-cyan-200 bg-white/80 px-3 py-2 text-sm font-medium text-cyan-800 shadow-sm">
                <SparklesIcon className="h-4 w-4" />
                ERP publik untuk tim operasional yang sedang tumbuh
              </div>

              <h1 className="text-5xl font-semibold leading-[1.05] text-slate-950 sm:text-6xl lg:text-7xl">
                Sync ERP
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700 sm:text-xl">
                Platform ERP multi-company untuk merapikan sales,
                procurement, inventory, rental, finance, dan integrasi
                dalam satu sistem yang siap dipakai tim bisnis modern.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={registerHref}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300 transition hover:bg-slate-800"
                >
                  Mulai pakai Sync ERP
                  <ArrowRightIcon className="h-4 w-4" />
                </a>
                <a
                  href="#modules"
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Lihat modul
                  <ChartBarSquareIcon className="h-4 w-4" />
                </a>
              </div>

              <div className="mt-8 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
                {proofPoints.map((point) => (
                  <div key={point} className="flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 flex-none text-emerald-600" />
                    <span>{point}</span>
                  </div>
                ))}
              </div>
<<<<<<< HEAD

              <div className="mt-12 grid gap-3 sm:grid-cols-3">
                {heroStats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur"
                  >
                    <p className="text-3xl font-semibold text-slate-950">
                      {item.value}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="min-w-0 lg:-mr-20 xl:-mr-28">
              <DashboardPreview className="mx-auto w-full max-w-5xl lg:rotate-1" />
            </div>
          </div>
=======
            </div>

            <DashboardPreview className="mt-12 lg:hidden" />

            <div className="mt-12 grid gap-3 sm:grid-cols-3 lg:max-w-2xl">
              {heroStats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur"
                >
                  <p className="text-3xl font-semibold text-slate-950">
                    {item.value}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="pointer-events-none absolute right-[-7rem] top-28 hidden w-[58rem] rotate-1 lg:block xl:right-[-3rem]">
            <DashboardPreview />
          </div>
>>>>>>> origin/dev
        </section>

        <section className="border-b border-slate-200 bg-white py-6">
          <div className="mx-auto grid max-w-7xl gap-3 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            {proofPoints.map((point) => (
              <div
                key={point}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700"
              >
                <ShieldCheckIcon className="h-5 w-5 text-emerald-600" />
                {point}
              </div>
            ))}
          </div>
        </section>

        <section id="platform" className="bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <SectionEyebrow icon={BuildingOffice2Icon}>
                  Platform operasi terpadu
                </SectionEyebrow>
                <h2 className="max-w-2xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
                  Semua divisi bergerak dari data yang sama.
                </h2>
                <p className="mt-5 text-base leading-8 text-slate-600">
                  Sync ERP menyambungkan aktivitas komersial, gudang,
                  rental, dan finance sehingga keputusan harian tidak
                  lagi bergantung pada file spreadsheet terpisah atau
                  update manual antar divisi.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    title: 'Kontrol multi-company',
                    text: 'Pisahkan data antar entitas bisnis tanpa kehilangan visibilitas grup.',
                    icon: BuildingOffice2Icon,
                  },
                  {
                    title: 'Workflow transaksi',
                    text: 'Dokumen bisnis saling terhubung dari order sampai pembayaran.',
                    icon: ClipboardDocumentCheckIcon,
                  },
                  {
                    title: 'Akses tim',
                    text: 'Tim bisa bekerja dengan konteks perusahaan dan role yang jelas.',
                    icon: UserGroupIcon,
                  },
                  {
                    title: 'Siap integrasi',
                    text: 'API docs dan WhatsApp integration mendukung proses operasional digital.',
                    icon: CloudArrowUpIcon,
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <item.icon className="h-6 w-6 text-cyan-700" />
                    <h3 className="mt-4 text-base font-semibold text-slate-950">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

<<<<<<< HEAD
        <section id="ai-erp" className="bg-slate-950 py-20 text-white sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
            <div>
              <SectionEyebrow icon={SparklesIcon}>
                AI-based ERP direction
              </SectionEyebrow>
              <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">
                ERP yang bergerak menuju command center seperti chat.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                Sync ERP disiapkan sebagai system of record yang bisa
                dikendalikan lewat UI tradisional, API, dan MCP. Arah
                produk berikutnya adalah halaman depan aplikasi yang
                terasa seperti workspace AI: tanya data, jalankan tool,
                dan tindaklanjuti proses operasional dari satu command
                surface.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={registerHref}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-cyan-50"
                >
                  Mulai dari Free
                  <ArrowRightIcon className="h-4 w-4" />
                </a>
                <a
                  href="#pricing"
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-white/20 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.14]"
                >
                  Lihat upgrade path
                </a>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-5 shadow-2xl shadow-cyan-950/30">
              <div className="rounded-xl bg-slate-900 p-4">
                <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                  <span className="h-3 w-3 rounded-full bg-rose-400" />
                  <span className="h-3 w-3 rounded-full bg-amber-300" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400" />
                  <span className="ml-2 text-xs font-medium text-slate-400">
                    Sync ERP AI workspace
                  </span>
                </div>
                <div className="mt-5 space-y-4">
                  {[
                    {
                      role: 'Operator',
                      text: 'Tampilkan order overdue minggu ini dan prioritas penagihannya.',
                    },
                    {
                      role: 'Sync ERP',
                      text: 'Ada 12 order overdue. Saya siapkan ringkasan customer, aging, nilai invoice, dan action follow-up.',
                    },
                    {
                      role: 'Tool call',
                      text: 'rental.orders.listOverdue -> accounting.invoices.getAging -> whatsapp.queueDraft',
                    },
                  ].map((message) => (
                    <div
                      key={message.role}
                      className="rounded-lg border border-white/10 bg-white/[0.06] p-4"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                        {message.role}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-200">
                        {message.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

=======
>>>>>>> origin/dev
        <section id="modules" className="bg-slate-50 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <SectionEyebrow icon={ServerStackIcon}>
                Modul bisnis inti
              </SectionEyebrow>
              <h2 className="text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
                Dari front office sampai back office, satu sistem.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-600">
                Modul Sync ERP dibuat untuk proses yang saling
                bergantung: penjualan memengaruhi stok, procurement
                memengaruhi cash flow, dan finance mendapat data dari
                transaksi aktual.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {modules.map((item) => (
                <article
                  key={item.title}
                  className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div
                    className={`inline-flex rounded-lg border p-3 ${item.accent}`}
                  >
                    <item.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-slate-950">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
              <div>
                <SectionEyebrow icon={BanknotesIcon}>
                  Harga dan limit
                </SectionEyebrow>
                <h2 className="text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
<<<<<<< HEAD
                  Mulai gratis, upgrade saat bisnis butuh kapasitas lebih.
                </h2>
                <p className="mt-5 text-base leading-8 text-slate-600">
                  Sync ERP punya tier Free untuk satu company dengan
                  iklan dan tanpa media. Paid tier membuka media,
                  multi-company, API, WhatsApp, dan limit operasional
                  yang lebih besar.
                </p>
              </div>
              <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-5 text-sm leading-6 text-cyan-900">
                Free plan aktif tanpa batas waktu untuk satu company.
                Paid plan tetap bisa memakai trial {BILLING_TRIAL_DAYS}
                hari saat upgrade flow diaktifkan.
              </div>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
=======
                  Tidak free. Mulai dengan trial, lanjut paket berbayar.
                </h2>
                <p className="mt-5 text-base leading-8 text-slate-600">
                  Sync ERP memakai paket komersial yang jelas: limit
                  user, company, dokumen bulanan, SKU, API key, dan
                  akses integrasi sudah ditentukan dari awal.
                </p>
              </div>
              <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-5 text-sm leading-6 text-cyan-900">
                Trial {BILLING_TRIAL_DAYS} hari tersedia untuk setup
                awal. Setelah trial, workspace perlu berada di Starter,
                Growth, Scale, atau Enterprise.
              </div>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
>>>>>>> origin/dev
              {BILLING_PLANS.map((plan) => (
                <PricingCard key={plan.key} plan={plan} />
              ))}
            </div>
          </div>
        </section>

        <section id="workflows" className="bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <SectionEyebrow icon={ArrowPathIcon}>
                  Alur kerja operasional
                </SectionEyebrow>
                <h2 className="text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
                  Proses penting tidak berhenti di satu departemen.
                </h2>
                <p className="mt-5 text-base leading-8 text-slate-600">
                  Sync ERP membantu tim melihat dokumen, status, dan
                  tindak lanjut dalam konteks yang sama sehingga proses
                  lebih mudah diaudit dan ditindaklanjuti.
                </p>
              </div>

              <div className="grid gap-4">
                {workflows.map((workflow) => (
                  <div
                    key={workflow.title}
                    className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-slate-950 p-2 text-white">
                          <workflow.icon className="h-5 w-5" />
                        </div>
                        <h3 className="text-base font-semibold text-slate-950">
                          {workflow.title}
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {workflow.steps.map((step) => (
                          <span
                            key={step}
                            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
                          >
                            {step}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="security"
          className="border-y border-slate-200 bg-slate-950 py-20 text-white sm:py-24"
        >
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1fr] lg:items-center lg:px-8">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.08] px-3 py-2 text-sm font-medium text-cyan-100">
                <LockClosedIcon className="h-4 w-4" />
                Keamanan dan tata kelola
              </div>
              <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">
                Dibangun untuk bisnis yang butuh kontrol lebih dari
                sekadar input data.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                Struktur multi-company, konteks pengguna, dan workflow
                dokumen membantu perusahaan menjaga data operasional
                tetap konsisten, jelas, dan siap ditinjau.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  title: 'Company context',
                  text: 'Pengguna memilih perusahaan kerja sebelum masuk ke proses inti.',
                  icon: BuildingOffice2Icon,
                },
                {
                  title: 'Operational trail',
                  text: 'Dokumen transaksi memberi jejak proses yang mudah diikuti.',
                  icon: DocumentCheckIcon,
                },
                {
                  title: 'Cloud workflow',
                  text: 'Tim bisa bekerja dari lokasi berbeda dengan proses yang sama.',
                  icon: CloudArrowUpIcon,
                },
                {
                  title: 'Finance control',
                  text: 'Piutang, utang, pembayaran, cash bank, dan jurnal berada dalam alur terpadu.',
                  icon: BanknotesIcon,
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-lg border border-white/10 bg-white/[0.08] p-5"
                >
                  <item.icon className="h-6 w-6 text-cyan-300" />
                  <h3 className="mt-4 text-base font-semibold">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 rounded-lg border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ecfeff_100%)] p-6 shadow-sm sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <h2 className="text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
                  Siapkan sistem operasi bisnis yang lebih disiplin.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
                  Jadikan Sync ERP sebagai pusat data untuk tim sales,
                  pembelian, gudang, rental, dan finance.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                <a
                  href={registerHref}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  Buat akun
                  <ArrowRightIcon className="h-4 w-4" />
                </a>
                <a
                  href={loginHref}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Masuk ke ERP
                  <ArrowRightOnRectangleIcon className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <BrandMark />
            <span className="font-medium text-slate-700">Sync ERP</span>
          </div>
<<<<<<< HEAD
          <div className="flex flex-wrap items-center gap-4">
            <a href="/privacy" className="hover:text-slate-800">
              Privacy
            </a>
            <a href="/terms" className="hover:text-slate-800">
              Terms
            </a>
            <button
              type="button"
              onClick={() => {
                import('@/features/legal/components/CookieConsent').then(
                  (m) => {
                    m.resetConsent();
                    window.location.reload();
                  }
                );
              }}
              className="hover:text-slate-800"
            >
              Kelola Cookie
            </button>
            <p>&copy; 2026 Sync ERP. Public marketing website.</p>
          </div>
=======
          <p>&copy; 2026 Sync ERP. Public marketing website.</p>
>>>>>>> origin/dev
        </div>
      </footer>
    </div>
  );
}
