import { Link } from 'react-router-dom';
import { BusinessShapeSchema } from '@sync-erp/shared';

interface PendingShapeBannerProps {
  businessShape?: string;
}

/**
 * Banner shown on dashboard when company businessShape is PENDING.
 * Prompts user to complete company setup before using business features.
 */
export default function PendingShapeBanner({
  businessShape,
}: PendingShapeBannerProps) {
  if (businessShape !== BusinessShapeSchema.enum.PENDING) {
    return null;
  }

  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-950 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-200 bg-white text-lg font-semibold text-amber-700">
          !
        </div>
        <div className="flex-1">
          <h2 className="mb-2 text-xl font-bold text-slate-950">
            Complete Your Company Setup
          </h2>
          <p className="mb-4 text-amber-800">
            Your company profile is incomplete. Please select a
            business type to unlock all features. Until then, you can
            only view data but cannot create new orders, invoices, or
            products.
          </p>
          <Link
            to="/settings/company"
            className="inline-flex items-center rounded-md bg-slate-950 px-4 py-2 font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Complete Setup →
          </Link>
        </div>
      </div>
    </div>
  );
}
