interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  tone?: 'dark' | 'light' | 'gradient';
  className?: string;
}

export function BrandMark({
  size = 'md',
  tone = 'gradient',
  className = '',
}: BrandMarkProps) {
  const sizeClasses = {
    sm: 'h-7 w-7 rounded-lg',
    md: 'h-9 w-9 rounded-xl',
    lg: 'h-11 w-11 rounded-2xl',
    xl: 'h-14 w-14 rounded-2xl',
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
    xl: 'h-8 w-8',
  };

  const toneClasses = {
    gradient:
      'bg-gradient-to-tr from-blue-600 via-blue-500 to-sky-400 text-white shadow-md shadow-blue-500/25 ring-1 ring-white/25',
    dark:
      'bg-slate-950 text-white shadow-lg shadow-slate-950/20 ring-1 ring-white/10',
    light:
      'border border-slate-200/80 bg-white text-blue-600 shadow-sm shadow-slate-900/5',
  };

  return (
    <div
      className={`flex shrink-0 items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 ${sizeClasses[size]} ${toneClasses[tone]} ${className}`}
      aria-label="Sync ERP"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconSizes[size]} drop-shadow-sm`}
      >
        <path
          d="M16.5 7.5L19 10M19 10L16.5 12.5M19 10H8.5C6.01472 10 4 12.0147 4 14.5C4 16.9853 6.01472 19 8.5 19H11"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7.5 16.5L5 14M5 14L7.5 11.5M5 14H15.5C17.9853 14 20 11.9853 20 9.5C20 7.01472 17.9853 5 15.5 5H13"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-80"
        />
      </svg>
    </div>
  );
}

