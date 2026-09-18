import type { ComponentType, SVGProps } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { formatCurrency, formatNumber } from '@/utils/format';

type StatCardTone = 'blue' | 'indigo' | 'emerald' | 'amber' | 'sky';
type IconType = ComponentType<SVGProps<SVGSVGElement>>;

interface StatCardProps {
  title: string;
  value: number | string;
  currency?: string;
  description?: string;
  isLoading?: boolean;
  icon: IconType;
  tone?: StatCardTone;
}

const toneStyles: Record<
  StatCardTone,
  { icon: string; line: string }
> = {
  blue: {
    icon: 'border-blue-100 bg-blue-50 text-blue-700',
    line: 'from-blue-500/70 via-blue-300/30 to-transparent',
  },
  indigo: {
    icon: 'border-blue-100 bg-blue-50 text-blue-700',
    line: 'from-blue-500/70 via-blue-300/30 to-transparent',
  },
  emerald: {
    icon: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    line: 'from-emerald-500/70 via-emerald-300/30 to-transparent',
  },
  amber: {
    icon: 'border-amber-100 bg-amber-50 text-amber-700',
    line: 'from-amber-500/70 via-amber-300/30 to-transparent',
  },
  sky: {
    icon: 'border-sky-100 bg-sky-50 text-sky-700',
    line: 'from-sky-500/70 via-sky-300/30 to-transparent',
  },
};

/**
 * StatCard component for displaying individual KPI metrics.
 * Part of Phase 1 Dashboard KPIs (US1).
 */
export function StatCard({
  title,
  value,
  currency,
  description,
  isLoading = false,
  icon: Icon,
  tone = 'blue',
}: StatCardProps) {
  // Format number with currency if provided
  const formattedValue =
    typeof value === 'number'
      ? currency
        ? formatCurrency(value, currency)
        : formatNumber(value)
      : value;
  const styles = toneStyles[tone];

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="animate-pulse p-5 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-4 h-3 w-1/2 rounded bg-slate-200" />
              <div className="h-7 w-3/4 rounded bg-slate-200" />
              <div className="mt-3 h-3 w-2/3 rounded bg-slate-100" />
            </div>
            <div className="h-10 w-10 rounded-xl bg-slate-100" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden transition-all duration-150 hover:shadow-card-hover">
      <CardContent className="p-5 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {title}
            </span>
            <p className="mt-2.5 break-words font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 tabular-nums">
              {formattedValue}
            </p>
            {description && (
              <p className="mt-1.5 text-xs text-slate-500">
                {description}
              </p>
            )}
          </div>
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${styles.icon}`}
          >
            <Icon className="h-4 w-4" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
