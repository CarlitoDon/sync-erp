import React from 'react';
import { BackButton } from '../ui/BackButton';

export interface PageHeaderProps {
  /** Main title displayed prominently */
  title: string;
  /** Optional subtitle for detail pages (can be a React node for links) */
  subtitle?: React.ReactNode;
  /** Optional description for list pages */
  description?: string;
  /** Optional badges to display next to the title (detail pages) */
  badges?: React.ReactNode;
  /** Optional action buttons displayed on the right */
  actions?: React.ReactNode;
  /** Show back button for detail pages (default: false) */
  showBackButton?: boolean;
  /** Custom back navigation handler */
  onBack?: () => void;
  /** Additional className for the container */
  className?: string;
}

/**
 * Unified page header component for both list and detail pages.
 * 
 * For list pages (default):
 * - Shows title and description
 * - Actions on the right
 * 
 * For detail pages (showBackButton=true):
 * - Shows back button, title, subtitle
 * - Badges and actions on the right
 *
 * @example
 * // List page
 * <PageHeader
 *   title="Products"
 *   description="Manage your product catalog"
 *   actions={<Button>+ Add Product</Button>}
 * />
 *
 * @example
 * // Detail page
 * <PageHeader
 *   title="PO-001"
 *   subtitle={<Link to="/suppliers/1">Supplier Name</Link>}
 *   badges={<StatusBadge status="CONFIRMED" domain="order" />}
 *   actions={<Button onClick={handlePost}>Post</Button>}
 *   showBackButton
 * />
 */
export function PageHeader({
  title,
  subtitle,
  description,
  badges,
  actions,
  showBackButton = false,
  // onBack is reserved for future use
  className = '',
}: PageHeaderProps) {
  // Detail page layout (with back button)
  if (showBackButton) {
    return (
      <div className={`flex items-center justify-between ${className}`}>
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {badges}
          {actions}
        </div>
      </div>
    );
  }

  // List page layout (no back button)
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${className}`}
    >
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {description && <p className="mt-1 text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
