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
  const sizeClass =
    size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm';
  const toneClass =
    tone === 'light'
      ? 'border border-white/25 bg-white text-slate-950 shadow-black/20'
      : 'bg-slate-950 text-white shadow-slate-950/20';

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl font-bold tracking-tight shadow-lg ring-1 ring-black/5 ${toneClass} ${sizeClass} ${className}`}
    >
      S
    </span>
  );
}
