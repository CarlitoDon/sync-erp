import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  ActionButton,
} from '@/components/ui';
import { TruckIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { RentalOrderPermissions } from '../hooks/useRentalOrderPermissions';

interface RentalActionsCardProps {
  permissions: RentalOrderPermissions;
  onConfirm: () => void;
  onRelease: () => void;
  onReturn: () => void;
  onCancel: () => void;
}

export function RentalActionsCard({
  permissions,
  onConfirm,
  onRelease,
  onReturn,
  onCancel,
}: RentalActionsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {permissions.canConfirm && (
          <ActionButton
            variant="primary"
            className="w-full"
            onClick={onConfirm}
          >
            Confirm Order
          </ActionButton>
        )}

        {permissions.canRelease && (
          <div className="space-y-2">
            <ActionButton
              variant="primary"
              className="w-full flex justify-center gap-2"
              onClick={onRelease}
            >
              <TruckIcon className="w-4 h-4" />
              Release Units (Serah Terima)
            </ActionButton>
            <p className="text-xs text-gray-500 text-center">
              Serahkan unit ke customer untuk memulai masa sewa.
            </p>
          </div>
        )}

        {permissions.canReturn && (
          <ActionButton
            variant="primary"
            className="w-full"
            onClick={onReturn}
          >
            Return Units (Kembalikan)
          </ActionButton>
        )}

        {permissions.canCancel && (
          <ActionButton
            variant="destructive"
            className="w-full"
            onClick={onCancel}
          >
            Cancel Order
          </ActionButton>
        )}

        <hr className="border-gray-100" />

        <ActionButton
          variant="outline"
          className="w-full"
          onClick={() => {
            toast('Invoice feature coming soon');
          }}
        >
          Create Invoice
        </ActionButton>
      </CardContent>
    </Card>
  );
}
