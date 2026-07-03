import { Card, CardContent } from '@/components/ui/Card';
import { formatCurrency } from '@/utils/format';

/* eslint-disable @sync-erp/no-hardcoded-enum */
type CardColor = 'default' | 'blue' | 'green' | 'red' | 'primary';
/* eslint-enable @sync-erp/no-hardcoded-enum */

export interface SummaryCardConfig {
  label: string;
  value: number | string;
  color?: CardColor;
  isCurrency?: boolean;
}

export interface SummaryCardsProps {
  cards: SummaryCardConfig[];
  columns?: 3 | 4;
  className?: string;
}

const colorClasses: Record<CardColor, string> = {
<<<<<<< HEAD
  default: 'text-slate-950',
  blue: 'text-cyan-700',
  green: 'text-emerald-700',
  red: 'text-red-600',
  primary: 'text-cyan-700',
=======
  default: 'text-gray-900',
  blue: 'text-blue-600',
  green: 'text-green-600',
  red: 'text-red-600',
  primary: 'text-primary-600',
>>>>>>> origin/dev
};

/**
 * Configurable summary cards grid.
 *
 * @example
 * <SummaryCards
 *   cards={[
 *     { label: 'Total', value: 45 },
 *     { label: 'Paid', value: 30, color: 'green' },
 *     { label: 'Outstanding', value: 50000, isCurrency: true, color: 'red' },
 *   ]}
 * />
 */
export function SummaryCards({
  cards,
  columns = 4,
  className = '',
}: SummaryCardsProps) {
  const gridClass =
    columns === 3
      ? 'grid-cols-1 md:grid-cols-3'
<<<<<<< HEAD
      : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4';
=======
      : 'grid-cols-2 md:grid-cols-4';
>>>>>>> origin/dev

  return (
    <div className={`grid ${gridClass} gap-4 md:gap-6 ${className}`}>
      {cards.map((card, index) => (
        <Card key={index}>
          <CardContent className="pt-6">
<<<<<<< HEAD
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
=======
            <p className="text-sm text-gray-500 uppercase">
>>>>>>> origin/dev
              {card.label}
            </p>
            <p
              className={`mt-2 font-bold ${colorClasses[card.color || 'default']} ${card.isCurrency ? 'text-2xl' : 'text-3xl'}`}
            >
              {card.isCurrency
                ? formatCurrency(Number(card.value))
                : card.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
