import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui';
import { formatDateTime } from '@/utils/format';
import { RentalOrderCalculations } from '../hooks/useRentalOrderCalculations';

interface RentalPeriodCardProps {
  startDate: Date | string;
  endDate: Date | string;
  calculations: RentalOrderCalculations;
}

export function RentalPeriodCard({
  startDate,
  endDate,
  calculations,
}: RentalPeriodCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rental Period</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: '2fr 2fr 1fr' }}
        >
          {/* Start Date */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex flex-col justify-center items-center text-center">
            <p className="text-xs text-blue-600 uppercase font-semibold mb-1">
              Start Date
            </p>
            <p className="font-medium text-gray-900">
              {calculations.startDayName}
            </p>
            <p className="text-sm text-gray-600">
              {formatDateTime(startDate)}
            </p>
          </div>

          {/* End Date */}
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-100 flex flex-col justify-center items-center text-center">
            <p className="text-xs text-purple-600 uppercase font-semibold mb-1">
              End Date
            </p>
            <p className="font-medium text-gray-900">
              {calculations.endDayName}
            </p>
            <p className="text-sm text-gray-600">
              {formatDateTime(endDate)}
            </p>
          </div>

          {/* Duration */}
          <div className="p-3 bg-green-50 rounded-lg border border-green-100 flex flex-col justify-center items-center">
            <p className="text-xs text-green-600 uppercase font-semibold mb-1">
              Durasi
            </p>
            <p className="font-bold text-xl text-green-700">
              {calculations.durationDays}
            </p>
            <p className="text-xs text-green-600">hari</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
