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
    <div className="rounded-lg overflow-hidden">
      <Link
        to={step.targetPath}
        className={`flex items-center gap-3 p-3 transition-all duration-200 group ${
          step.isCompleted
            ? 'bg-green-50 hover:bg-green-100'
            : 'bg-gray-50 hover:bg-blue-50'
        }`}
      >
        {/* Status Icon */}
        <div className="flex-shrink-0">
          {step.isCompleted ? (
            <CheckCircleSolidIcon className="w-6 h-6 text-green-500" />
          ) : (
            <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center">
              <span className="text-sm">{step.icon}</span>
            </div>
          )}
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium ${
              step.isCompleted ? 'text-green-700' : 'text-gray-900'
            }`}
          >
            {step.title}
          </p>
        </div>

        {/* Expand Button */}
        {step.description && (
          <button
            onClick={handleToggle}
            className="p-1 rounded-full hover:bg-gray-200 transition-colors"
            aria-label={
              isExpanded ? 'Collapse details' : 'Expand details'
            }
          >
            <ChevronDownIcon
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>
        )}

        {/* Arrow */}
        <ChevronRightIcon
          className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
            step.isCompleted
              ? 'text-green-400'
              : 'text-gray-400 group-hover:translate-x-1 group-hover:text-blue-500'
          }`}
        />
      </Link>

      {/* Expandable Description */}
      {isExpanded && step.description && (
        <div className="px-3 py-2 bg-gray-100 border-t border-gray-200">
          <p className="text-xs text-gray-600 pl-9">
            {step.description}
          </p>
        </div>
      )}
    </div>
  );
}
