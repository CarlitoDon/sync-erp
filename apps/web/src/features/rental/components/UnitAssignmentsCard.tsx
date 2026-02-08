import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { RentalOrderCalculations } from '../hooks/useRentalOrderCalculations';

interface RentalUnitAssignment {
  id: string;
  rentalItemUnit?: {
    unitCode: string;
    condition: string;
    rentalItem?: {
      product?: {
        name: string;
      };
    };
  } | null;
}

interface UnitAssignmentsCardProps {
  assignments: RentalUnitAssignment[];
  calculations: RentalOrderCalculations;
}

export function UnitAssignmentsCard({
  assignments,
  calculations,
}: UnitAssignmentsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Unit Assignments</CardTitle>
        <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded-full">
          {calculations.assignedUnitsCount} /{' '}
          {calculations.totalUnitsRequired} Assigned
        </span>
      </CardHeader>
      <CardContent>
        {assignments.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex items-start gap-3 p-3 border rounded-lg hover:shadow-sm transition-shadow"
              >
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <CheckCircleIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">
                    {assignment.rentalItemUnit?.unitCode}
                  </p>
                  <p className="text-xs text-gray-500">
                    {
                      assignment.rentalItemUnit?.rentalItem?.product
                        ?.name
                    }
                  </p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                      {assignment.rentalItemUnit?.condition}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
            No units assigned yet. Confirmed orders will reserve
            units.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
