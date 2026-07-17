import { useState } from 'react';
import OnboardingStep from '@/features/dashboard/components/OnboardingStep';
import { useOnboardingProgress } from '@/features/dashboard/hooks/useOnboardingProgress';
import type { DashboardMetrics } from '@/types/api';
import { Card, CardContent } from '@/components/ui/Card';

interface OnboardingGuideProps {
  metrics: DashboardMetrics | null;
}

export default function OnboardingGuide({
  metrics,
}: OnboardingGuideProps) {
  const [isDismissed, setIsDismissed] = useState(() => {
    const key = 'onboarding-dismissed';
    return localStorage.getItem(key) === 'true';
  });

  // Use hook to get data-driven progress
  const progress = useOnboardingProgress(metrics);

  // Handle dismiss
  const handleDismiss = () => {
    localStorage.setItem('onboarding-dismissed', 'true');
    setIsDismissed(true);
  };

  const handleRestore = () => {
    localStorage.removeItem('onboarding-dismissed');
    setIsDismissed(false);
  };

  // If dismissed, show restore button
  if (isDismissed) {
    return (
      <Card>
        <CardContent className="p-4">
          <button
            onClick={handleRestore}
            className="text-sm font-medium text-cyan-700 hover:text-cyan-900"
          >
            Show Getting Started Guide
          </button>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (progress.loading) {
    return (
      <Card className="animate-pulse">
        <CardContent>
          <div className="mb-4 h-6 w-40 rounded bg-slate-200" />
          <div className="mb-4 h-2 w-full rounded bg-slate-200" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-12 rounded bg-slate-100" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={`${
        progress.isAllComplete
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-slate-200'
      }`}
    >
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">
            {progress.isAllComplete
              ? 'Setup Complete'
              : 'Getting Started'}
          </h2>
          <span className="text-sm text-slate-500">
            {progress.completedCount} of {progress.totalCount}{' '}
            completed
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              progress.isAllComplete
                ? 'bg-emerald-500'
                : 'bg-cyan-500'
            }`}
            style={{ width: `${progress.percentComplete}%` }}
          />
        </div>

        {/* Success Message */}
        {progress.isAllComplete && (
          <div className="mb-4 rounded-lg bg-emerald-100 p-3">
            <p className="text-sm text-emerald-800">
              Congratulations! You've completed all the setup steps.
              Your company is ready to go!
            </p>
          </div>
        )}

        {/* Steps List */}
        <div className="space-y-2">
          {progress.steps.map((step) => (
            <OnboardingStep key={step.id} step={step} />
          ))}
        </div>

        {/* Dismiss Button */}
        {progress.isAllComplete && (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <button
              onClick={handleDismiss}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Dismiss this guide
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
