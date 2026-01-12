import { RentalOrderStatus } from '@sync-erp/shared';
import { ORDER_STATUS_LABELS } from '../constants';

interface OrderStatusFilterProps {
  value: RentalOrderStatus | 'ALL';
  onChange: (status: RentalOrderStatus | 'ALL') => void;
}

const ALL_STATUSES = [
  'ALL',
  ...Object.values(RentalOrderStatus),
] as const;

/**
 * Status filter button group for rental orders.
 */
export default function OrderStatusFilter({
  value,
  onChange,
}: OrderStatusFilterProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {ALL_STATUSES.map((status) => {
        const isSelected = value === status;
        return (
          <button
            key={status}
            onClick={() =>
              onChange(status as RentalOrderStatus | 'ALL')
            }
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              isSelected
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status === 'ALL'
              ? 'Semua'
              : ORDER_STATUS_LABELS[status as RentalOrderStatus]}
          </button>
        );
      })}
    </div>
  );
}
