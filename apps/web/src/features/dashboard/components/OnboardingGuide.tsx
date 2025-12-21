import { useState } from 'react';
import OnboardingStep from '@/features/dashboard/components/OnboardingStep';
import { useOnboardingProgress } from '@/features/dashboard/hooks/useOnboardingProgress';
import type { DashboardMetrics } from '@/types/api';

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
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <button
          onClick={handleRestore}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Show Getting Started Guide
        </button>
      </div>
    );
  }

  // Loading state
  if (progress.loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-40 mb-4" />
        <div className="h-2 bg-gray-200 rounded w-full mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border p-6 ${
        progress.isAllComplete
          ? 'border-green-300 bg-green-50'
          : 'border-gray-100'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          {progress.isAllComplete
            ? '🎉 Setup Complete!'
            : 'Getting Started'}
        </h2>
        <span className="text-sm text-gray-500">
          {progress.completedCount} of {progress.totalCount} completed
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-gray-200 rounded-full mb-4 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            progress.isAllComplete
              ? 'bg-green-500'
              : 'bg-gradient-to-r from-blue-500 to-purple-500'
          }`}
          style={{ width: `${progress.percentComplete}%` }}
        />
      </div>

      {/* Success Message */}
      {progress.isAllComplete && (
        <div className="mb-4 p-3 bg-green-100 rounded-lg">
          <p className="text-green-800 text-sm">
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
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={handleDismiss}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Dismiss this guide
          </button>
        </div>
      )}
    </div>
  );
}
