import { Badge } from '@/components/ui/badge';

import { PaymentStatus } from '@sync-erp/shared';

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  className?: string;
}

const statusConfig: Record<
  NonNullable<PaymentStatus>,
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
  }
> = {
  PENDING: { label: 'Payment Pending', variant: 'destructive' },
  PARTIAL: { label: 'Partially Paid', variant: 'outline' },
  PAID_UPFRONT: { label: 'Paid (Upfront)', variant: 'default' },
  SETTLED: { label: 'Settled', variant: 'secondary' },
};

export function PaymentStatusBadge({
  status,
  className,
}: PaymentStatusBadgeProps) {
  if (!status) return null;

  const config = statusConfig[status];
  if (!config) return null;

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
