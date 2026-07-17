interface BrandMarkProps {
  size?: 'sm' | 'md';
  tone?: 'dark' | 'light';
  className?: string;
}

export function BrandMark({
  size = 'md',
  tone = 'dark',
  className = '',
}: BrandMarkProps) {
  const sizeClass = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm';
  const toneClass =
    tone === 'light'
      ? 'border border-white/10 bg-white text-slate-950'
      : 'bg-slate-950 text-white';

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg font-semibold shadow-sm ${toneClass} ${sizeClass} ${className}`}
    >
      S
    </span>
  );
}
