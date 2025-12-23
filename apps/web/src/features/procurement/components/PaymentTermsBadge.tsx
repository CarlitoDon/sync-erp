import { Badge } from '@/components/ui/badge';

import {
  PaymentTermsType,
  PaymentTermsSchema,
} from '@sync-erp/shared';

interface PaymentTermsBadgeProps {
  terms: PaymentTermsType;
  className?: string;
}

/* eslint-disable @sync-erp/no-hardcoded-enum */
const termConfig: Partial<
  Record<
    PaymentTermsType,
    {
      label: string;
      variant: 'default' | 'secondary' | 'destructive' | 'outline';
    }
  >
> = {
  [PaymentTermsSchema.enum.NET_30]: {
    label: 'Net 30',
    variant: 'secondary',
  },
  [PaymentTermsSchema.enum.PARTIAL]: {
    label: 'Partial',
    variant: 'outline',
  },
  [PaymentTermsSchema.enum.UPFRONT]: {
    label: 'Cash Upfront',
    variant: 'destructive',
  },
};
/* eslint-enable @sync-erp/no-hardcoded-enum */

export function PaymentTermsBadge({
  terms,
  className,
}: PaymentTermsBadgeProps) {
  const config = termConfig[terms] || {
    label: terms,
    variant: 'default',
  };

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
