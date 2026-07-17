import * as React from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false);

  return (
    <div className="relative inline-flex items-center">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children}
      </div>
      {isVisible && (
        <div className="absolute left-full top-1/2 z-50 ml-2 w-64 -translate-y-1/2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-xl">
          {content}
        </div>
      )}
    </div>
  );
}
