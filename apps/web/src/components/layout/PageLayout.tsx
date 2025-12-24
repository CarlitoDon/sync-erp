import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({
  children,
  className = '',
}: PageContainerProps) {
  return <div className={`space-y-6 ${className}`}>{children}</div>;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${className}`}
    >
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {description && (
          <p className="mt-1 text-gray-500">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-3">{actions}</div>
      )}
    </div>
  );
}
