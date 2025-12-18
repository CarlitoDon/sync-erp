interface StatCardProps {
  title: string;
  value: number | string;
  currency?: string;
  description?: string;
  isLoading?: boolean;
}

/**
 * StatCard component for displaying individual KPI metrics.
 * Part of Phase 1 Dashboard KPIs (US1).
 */
export function StatCard({
  title,
  value,
  currency,
  description,
  isLoading = false,
}: StatCardProps) {
  // Format number with currency if provided
  const formattedValue =
    typeof value === 'number'
      ? currency
        ? new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
          }).format(value)
        : new Intl.NumberFormat('id-ID').format(value)
      : value;

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
        <div className="h-8 bg-gray-200 rounded w-3/4" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900">
        {formattedValue}
      </p>
      {description && (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      )}
    </div>
  );
}
