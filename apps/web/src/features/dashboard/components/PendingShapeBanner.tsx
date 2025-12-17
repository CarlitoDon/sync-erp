import { Link } from 'react-router-dom';

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
  if (businessShape !== 'PENDING') {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-xl mb-6">
      <div className="flex items-start gap-4">
        <div className="text-4xl">⚠️</div>
        <div className="flex-1">
          <h2 className="text-xl font-bold mb-2">
            Complete Your Company Setup
          </h2>
          <p className="text-amber-100 mb-4">
            Your company profile is incomplete. Please select a
            business type to unlock all features. Until then, you can
            only view data but cannot create new orders, invoices, or
            products.
          </p>
          <Link
            to="/settings/company"
            className="inline-flex items-center px-4 py-2 bg-white text-orange-600 font-semibold rounded-lg hover:bg-orange-50 transition-colors"
          >
            Complete Setup →
          </Link>
        </div>
      </div>
    </div>
  );
}
