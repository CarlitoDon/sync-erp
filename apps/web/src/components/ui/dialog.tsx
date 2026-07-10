import * as React from 'react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export const Dialog = ({
  open,
  onOpenChange,
  children,
}: DialogProps) => {
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${
        open ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
      data-state={open ? 'open' : 'closed'}
    >
      <div
        className={`fixed inset-0 bg-black/50 transition-all duration-[var(--duration-normal)] ease-[var(--ease-out)] ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={() => onOpenChange(false)}
      />
      <div
        className={`relative z-50 w-full max-w-lg transform rounded-xl bg-white p-6 shadow-2xl transition-all duration-[var(--duration-normal)] ease-[var(--ease-out)] ${
          open
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-2'
        }`}
      >
        {children}
      </div>
    </div>
  );
};

export const DialogContent = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => <div className={className}>{children}</div>;

export const DialogHeader = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => <div className={`mb-4 ${className}`}>{children}</div>;

export const DialogTitle = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <h2
    className={`text-lg font-semibold leading-none tracking-tight ${className}`}
  >
    {children}
  </h2>
);

export const DialogFooter = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`mt-4 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className}`}
  >
    {children}
  </div>
);
