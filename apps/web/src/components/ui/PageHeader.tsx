import { BackButton } from './BackButton';

export interface PageHeaderProps {
  /** Main title displayed prominently */
  title: string;
  /** Optional subtitle (can be a React node for links) */
  subtitle?: React.ReactNode;
  /** Optional badges to display next to the title */
  badges?: React.ReactNode;
  /** Optional action buttons displayed on the right */
  actions?: React.ReactNode;
}

/**
 * Reusable page header component for detail pages.
 * Provides consistent layout: BackButton | Title/Subtitle | Badges | Actions
 *
 * @example
 * <PageHeader
 *   title="PO-001"
 *   subtitle={<Link to="/suppliers/1">Supplier Name</Link>}
 *   badges={<StatusBadge status="CONFIRMED" domain="order" />}
 *   actions={<Button onClick={handlePost}>Post</Button>}
 * />
 */
export function PageHeader({
  title,
  subtitle,
  badges,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {badges}
        {actions}
      </div>
    </div>
  );
}
