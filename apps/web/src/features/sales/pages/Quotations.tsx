import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import {
  PageContainer,
  PageHeader,
} from '@/components/layout/PageLayout';
import { Card } from '@/components/ui/Card';

export default function Quotations() {
  return (
    <PageContainer>
      {/* Header */}
      <PageHeader
        title="Quotations"
        description="Create and manage customer quotations"
        actions={
          <button
            disabled
            className="
              inline-flex items-center gap-2 px-4 py-2.5 
              bg-primary-600 text-white font-medium rounded-lg
              opacity-50 cursor-not-allowed
            "
          >
            + Create Quotation
          </button>
        }
      />

      {/* Coming Soon Card */}
      <Card className="p-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-4">
            <ClipboardDocumentListIcon className="w-8 h-8 text-primary-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Quotations Module
          </h2>
          <p className="text-gray-500 max-w-md mb-6">
            Create quotations for your customers before converting
            them to Sales Orders. This feature is coming soon!
          </p>
          <span className="inline-flex px-3 py-1 bg-amber-100 text-amber-700 text-sm font-medium rounded-full">
            Coming Soon
          </span>
        </div>
      </Card>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <h3 className="font-medium text-gray-900 mb-1">
            Draft Quotes
          </h3>
          <p className="text-2xl font-bold text-gray-400">0</p>
        </Card>
        <Card className="p-4">
          <h3 className="font-medium text-gray-900 mb-1">
            Sent to Customer
          </h3>
          <p className="text-2xl font-bold text-gray-400">0</p>
        </Card>
        <Card className="p-4">
          <h3 className="font-medium text-gray-900 mb-1">
            Converted to SO
          </h3>
          <p className="text-2xl font-bold text-gray-400">0</p>
        </Card>
      </div>
    </PageContainer>
  );
}
