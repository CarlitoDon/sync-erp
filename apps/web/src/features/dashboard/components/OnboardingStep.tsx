import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRightIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolidIcon } from '@heroicons/react/24/solid';
import type { OnboardingStep as OnboardingStepType } from '@/features/dashboard/types';

interface OnboardingStepProps {
  step: OnboardingStepType;
}

export default function OnboardingStep({
  step,
}: OnboardingStepProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = (e: React.MouseEvent) => {
    // Prevent navigation when clicking the expand button
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="overflow-hidden rounded-xl">
      <Link
        to={step.targetPath}
        className={`group flex items-center gap-3 p-3 transition-all duration-200 ${
          step.isCompleted
            ? 'bg-emerald-50 hover:bg-emerald-100'
            : 'bg-slate-50 hover:bg-primary-50'
        }`}
      >
        {/* Status Icon */}
        <div className="flex-shrink-0">
          {step.isCompleted ? (
            <CheckCircleSolidIcon className="h-6 w-6 text-emerald-500" />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-300">
              <span className="text-sm">{step.icon}</span>
            </div>
          )}
        </div>

        {/* Title */}
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-medium ${
              step.isCompleted ? 'text-emerald-700' : 'text-slate-950'
            }`}
          >
            {step.title}
          </p>
        </div>

        {/* Expand Button */}
        {step.description && (
          <button
            type="button"
            onClick={handleToggle}
            className="rounded-full p-1 transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label={
              isExpanded ? 'Collapse details' : 'Expand details'
            }
          >
            <ChevronDownIcon
              className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>
        )}

        {/* Arrow */}
        <ChevronRightIcon
          className={`h-5 w-5 flex-shrink-0 transition-transform duration-200 ${
            step.isCompleted
              ? 'text-emerald-400'
              : 'text-slate-400 group-hover:translate-x-1 group-hover:text-primary-600'
          }`}
        />
      </Link>

      {/* Expandable Description */}
      {isExpanded && step.description && (
        <div className="border-t border-slate-200 bg-slate-100 px-3 py-2">
          <p className="pl-9 text-xs text-slate-600">
            {step.description}
          </p>
        </div>
      )}
    </div>
  );
}
