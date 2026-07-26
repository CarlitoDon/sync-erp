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
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/90 p-5 text-amber-950 shadow-sm sm:p-6">
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
            className="inline-flex items-center rounded-xl bg-slate-950 px-4 py-2.5 font-semibold text-white transition duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 active:scale-[0.98]"
          >
            Complete Setup →
          </Link>
        </div>
      </div>
    </div>
  );
}
