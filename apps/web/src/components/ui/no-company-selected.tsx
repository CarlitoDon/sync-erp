import { BuildingOffice2Icon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

interface NoCompanySelectedProps {
  /** Custom message to display */
  message?: string;
  /** Label for the action link */
  actionLabel?: string;
  /** Href for the action link */
  actionHref?: string;
}

/**
 * Empty state component displayed when no company is selected.
 * Provides consistent messaging and a call-to-action to select a company.
 *
 * @example
 * // Default usage
 * if (!currentCompany) return <NoCompanySelected />;
 *
 * @example
 * // Custom message
 * <NoCompanySelected message="Select a company to view suppliers." />
 */
export function NoCompanySelected({
  message = 'Please select a company to continue.',
  actionLabel = 'Select a company',
  actionHref = '/companies',
}: NoCompanySelectedProps) {
  return (
    <div className="flex flex-col items-center justify-center h-64 py-12">
      <BuildingOffice2Icon className="h-12 w-12 text-gray-400 mb-4" />
      <p className="text-gray-500 text-center max-w-sm">{message}</p>
      <Link
        to={actionHref}
        className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
