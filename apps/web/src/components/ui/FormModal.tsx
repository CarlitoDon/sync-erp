import React from 'react';

/* eslint-disable @sync-erp/no-hardcoded-enum */
interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
}
/* eslint-enable @sync-erp/no-hardcoded-enum */

const maxWidthClasses = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '4xl': 'sm:max-w-4xl',
};

export default function FormModal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'lg',
}: FormModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div
          className="fixed inset-0 transition-opacity"
          aria-hidden="true"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={onClose}
        />

        {/* Centering trick */}
        <span
          className="hidden sm:inline-block sm:align-middle sm:h-screen"
          aria-hidden="true"
        >
          &#8203;
        </span>

        <div
          className={`relative z-10 inline-block align-bottom bg-white rounded-lg text-left shadow-xl transform transition-all sm:my-8 sm:align-middle sm:w-full ${maxWidthClasses[maxWidth]}`}
        >
          {/* Header */}
          <div className="bg-white rounded-lg px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <h3
              className="text-lg leading-6 font-medium text-gray-900 mb-4"
              id="modal-title"
            >
              {title}
            </h3>

            {/* Content area - scrollable when content exceeds max height */}
            <div className="max-h-[70vh] overflow-y-auto">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
