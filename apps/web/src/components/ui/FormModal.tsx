import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

/* eslint-disable @sync-erp/no-hardcoded-enum */
interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '5xl';
  zIndex?: string;
  disableBackdropClick?: boolean;
}
/* eslint-enable @sync-erp/no-hardcoded-enum */

const maxWidthClasses = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '4xl': 'sm:max-w-4xl',
  '5xl': 'sm:max-w-5xl',
};

export default function FormModal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'lg',
  zIndex = 'z-50',
  disableBackdropClick = false,
}: FormModalProps) {
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 ${zIndex} overflow-y-auto`}
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Overlay */}
        <div
          className="fixed inset-0 transition-opacity"
          aria-hidden="true"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)' }}
          onClick={disableBackdropClick ? undefined : onClose}
        />

        {/* Centering trick */}
        <span
          className="hidden sm:inline-block sm:align-middle sm:h-screen"
          aria-hidden="true"
        >
          &#8203;
        </span>

        <div
          className={`relative z-10 inline-block max-h-[92vh] transform overflow-y-auto rounded-2xl border border-slate-200/80 bg-white text-left align-bottom shadow-2xl shadow-slate-900/15 transition-all sm:my-8 sm:w-full sm:align-middle ${maxWidthClasses[maxWidth]}`}
        >
          {/* Header & Content */}
          <div className="rounded-2xl bg-white p-5 sm:p-7">
            <div className="flex items-center justify-between -mx-5 -mt-5 sm:-mx-7 sm:-mt-7 px-5 pt-5 sm:px-7 sm:pt-6 pb-4 mb-6 border-b border-slate-100 bg-white/95 backdrop-blur-xs sticky top-0 z-20 rounded-t-2xl">
              <h3
                className="text-lg sm:text-xl font-bold tracking-tight text-slate-900"
                id="modal-title"
              >
                {title}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 cursor-pointer"
                aria-label="Tutup modal"
                title="Tutup"
              >
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Content area */}
            <div>{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
