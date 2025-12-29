import { PartnerTypeSchema } from '@sync-erp/shared';
import { PartnerListPage } from '@/features/common/components';

/**
 * Suppliers page - thin wrapper around PartnerListPage.
 * All business logic is handled by the shared component.
 */
export default function Suppliers() {
  return (
    <PartnerListPage
      type={PartnerTypeSchema.enum.SUPPLIER}
      label="Supplier"
      labelPlural="Suppliers"
      basePath="/suppliers"
    />
  );
}
