import { Badge } from '@/components/ui/badge';

type PaymentTerms = 'NET_30' | 'PARTIAL' | 'UPFRONT';

interface PaymentTermsBadgeProps {
  terms: PaymentTerms;
  className?: string;
}

const termConfig: Record<
  PaymentTerms,
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
  }
> = {
  NET_30: { label: 'Net 30', variant: 'secondary' },
  PARTIAL: { label: 'Partial', variant: 'outline' },
  UPFRONT: { label: 'Cash Upfront', variant: 'destructive' },
};

export function PaymentTermsBadge({
  terms,
  className,
}: PaymentTermsBadgeProps) {
  const config = termConfig[terms] || termConfig.NET_30;

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
