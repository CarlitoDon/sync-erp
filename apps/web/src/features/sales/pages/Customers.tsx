import { PartnerTypeSchema } from '@sync-erp/shared';
import { PartnerListPage } from '@/features/common/components';

/**
 * Customers page - thin wrapper around PartnerListPage.
 * All business logic is handled by the shared component.
 */
export default function Customers() {
  return (
    <PartnerListPage
      type={PartnerTypeSchema.enum.CUSTOMER}
      label="Customer"
      labelPlural="Customers"
      basePath="/customers"
    />
  );
}
