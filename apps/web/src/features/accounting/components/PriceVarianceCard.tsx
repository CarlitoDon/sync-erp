import { formatCurrency } from '@/utils/format';

// Simple SVG icons (avoiding lucide-react dependency)
const AlertTriangleIcon = () => (
  <svg
    className="h-5 w-5 text-amber-600 flex-shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
);

const CheckIcon = () => (
  <svg
    className="h-5 w-5 text-green-600"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

interface PriceComparisonItem {
  productName: string;
  poQuantity: number;
  poPrice: number;
  billQuantity: number;
  billPrice: number;
}

interface PriceVarianceCardProps {
  items: PriceComparisonItem[];
  /** Callback when user acknowledges variance */
  onAcknowledge?: (acknowledged: boolean, reason?: string) => void;
  /** Whether to show acknowledgment UI (for draft bills with variance) */
  showAcknowledgment?: boolean;
  /** Current acknowledgment state */
  isAcknowledged?: boolean;
}

/**
 * FR-049: Side-by-side price comparison card
 * Shows PO price vs Bill price with variance percentage
 */
export function PriceVarianceCard({
  items,
  onAcknowledge,
  showAcknowledgment = false,
  isAcknowledged = false,
}: PriceVarianceCardProps) {
  // Calculate variance for each item
  const itemsWithVariance = items.map((item) => {
    const poTotal = item.poQuantity * item.poPrice;
    const billTotal = item.billQuantity * item.billPrice;
    const variance = billTotal - poTotal;
    const variancePercent =
      poTotal > 0 ? (variance / poTotal) * 100 : 0;
    return { ...item, poTotal, billTotal, variance, variancePercent };
  });

  // Check if there's any material variance (> 0.01% difference)
  const hasVariance = itemsWithVariance.some(
    (item) => Math.abs(item.variancePercent) > 0.01
  );

  // Calculate totals
  const totalPO = itemsWithVariance.reduce(
    (sum, i) => sum + i.poTotal,
    0
  );
  const totalBill = itemsWithVariance.reduce(
    (sum, i) => sum + i.billTotal,
    0
  );
  const totalVariance = totalBill - totalPO;
  const totalVariancePercent =
    totalPO > 0 ? (totalVariance / totalPO) * 100 : 0;

  if (!hasVariance) {
    return (
      <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
        <CheckIcon />
        <span className="text-green-800 font-medium">
          Prices match PO (3-Way Match Passed)
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Variance Warning */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <AlertTriangleIcon />
        <div>
          <p className="font-medium text-amber-800">
            Price Discrepancy Detected
          </p>
          <p className="text-sm text-amber-700 mt-1">
            Bill prices differ from Purchase Order. Review the
            comparison below.
          </p>
        </div>
      </div>

      {/* Comparison Table - FR-049 */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500">
                Product
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">
                PO Price
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">
                Bill Price
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">
                Variance
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {itemsWithVariance.map((item, idx) => (
              <tr key={idx}>
                <td className="px-4 py-3 text-gray-900">
                  {item.productName}
                  <span className="text-gray-500 ml-2">
                    ({item.poQuantity} qty)
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatCurrency(item.poTotal)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatCurrency(item.billTotal)}
                </td>
                <td
                  className={`px-4 py-3 text-right font-mono font-medium ${
                    Math.abs(item.variancePercent) > 5
                      ? 'text-red-600'
                      : 'text-amber-600'
                  }`}
                >
                  {item.variance >= 0 ? '+' : ''}
                  {formatCurrency(item.variance)}
                  <span className="ml-1 text-xs">
                    ({item.variancePercent.toFixed(1)}%)
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr className="font-semibold">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right font-mono">
                {formatCurrency(totalPO)}
              </td>
              <td className="px-4 py-3 text-right font-mono">
                {formatCurrency(totalBill)}
              </td>
              <td
                className={`px-4 py-3 text-right font-mono ${
                  Math.abs(totalVariancePercent) > 5
                    ? 'text-red-600'
                    : 'text-amber-600'
                }`}
              >
                {totalVariance >= 0 ? '+' : ''}
                {formatCurrency(totalVariance)}
                <span className="ml-1 text-xs">
                  ({totalVariancePercent.toFixed(1)}%)
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* FR-050: Acknowledgment Checkbox */}
      {showAcknowledgment && onAcknowledge && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isAcknowledged}
              onChange={(e) => onAcknowledge(e.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
            />
            <span className="text-sm text-gray-700">
              <strong>
                I confirm this price variance is intentional.
              </strong>
              <br />
              <span className="text-gray-500">
                By checking this box, you acknowledge the discrepancy
                and approve proceeding with the Bill creation.
              </span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
