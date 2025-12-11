import { AccountGroup } from '@sync-erp/shared';
import { formatCurrency } from '../utils/format';

export interface ReportSection {
  title: string;
  groups: AccountGroup[];
  totalLabel: string;
  totalValue: number;
}

export interface FinancialReportProps {
  title: string;
  subtitle?: string;
  sections: ReportSection[];
  grandTotalLabel?: string;
  grandTotalValue?: number;
  isBalanced?: boolean; // For Balance Sheet
}

export function FinancialReport({
  title,
  subtitle,
  sections,
  grandTotalLabel,
  grandTotalValue,
  isBalanced,
}: FinancialReportProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-8 py-6 border-b border-gray-200 flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {isBalanced !== undefined && (
          <span
            className={`px-3 py-1 text-sm font-medium rounded-full ${
              isBalanced ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {isBalanced ? 'Balanced' : 'Unbalanced'}
          </span>
        )}
      </div>

      <div className="p-8 space-y-8">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-2">
              {section.title}
            </h3>

            <div className="space-y-6">
              {section.groups.map((group) => (
                <div key={group.type}>
                  {/* Usually group.type is redundant if we group by Type, 
                         but groups allows multiple subgroups if needed. 
                         Here we assume AccountGroup structure. */}
                  {group.accounts.length > 0 && (
                    <table className="w-full text-sm">
                      <tbody>
                        {group.accounts.map((acc) => (
                          <tr key={acc.id} className="group hover:bg-gray-50">
                            <td className="py-1 text-gray-500 w-24">{acc.code}</td>
                            <td className="py-1 text-gray-700">{acc.name}</td>
                            <td className="py-1 text-right font-medium text-gray-900">
                              {formatCurrency(acc.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div className="flex justify-between items-center py-2 text-sm font-medium text-gray-600">
                    <span>Total {group.type}</span>
                    <span>{formatCurrency(group.total)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center font-bold text-gray-900">
              <span>{section.totalLabel}</span>
              <span>{formatCurrency(section.totalValue)}</span>
            </div>
          </div>
        ))}

        {grandTotalLabel && (
          <div className="mt-8 pt-6 border-t-2 border-gray-300 flex justify-between items-center text-xl font-bold text-gray-900">
            <span>{grandTotalLabel}</span>
            <span>{formatCurrency(grandTotalValue || 0)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
