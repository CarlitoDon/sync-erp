import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';

export default function Quotations() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Quotations
          </h1>
          <p className="text-gray-500">
            Create and manage customer quotations
          </p>
        </div>
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
      </div>

      {/* Coming Soon Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
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
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-1">
            Draft Quotes
          </h3>
          <p className="text-2xl font-bold text-gray-400">0</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-1">
            Sent to Customer
          </h3>
          <p className="text-2xl font-bold text-gray-400">0</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-1">
            Converted to SO
          </h3>
          <p className="text-2xl font-bold text-gray-400">0</p>
        </div>
      </div>
    </div>
  );
}
