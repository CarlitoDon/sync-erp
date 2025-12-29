import React from 'react';

// Re-export PageHeader from dedicated file
export { PageHeader, type PageHeaderProps } from './PageHeader';

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
