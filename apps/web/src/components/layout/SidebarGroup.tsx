import { useState, useEffect, useRef, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { useSidebar } from '@/contexts/SidebarContext';

interface SidebarGroupProps {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  activePrefixes?: string[];
  defaultPath?: string;
}

export default function SidebarGroup({
  label,
  icon,
  children,
  defaultOpen = false,
  activePrefixes = [],
  defaultPath,
}: SidebarGroupProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isCollapsed, isMobileOpen } = useSidebar();
  const isCompact = isCollapsed && !isMobileOpen;

  const isChildActive = activePrefixes.some(
    (prefix) =>
      location.pathname === prefix || location.pathname.startsWith(`${prefix}/`)
  );

  const [isOpen, setIsOpen] = useState(defaultOpen || isChildActive);
  const [showFlyout, setShowFlyout] = useState(false);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-expand group if current route navigates inside this group
  useEffect(() => {
    if (isChildActive) {
      setIsOpen(true);
    }
  }, [isChildActive]);

  const handleMouseEnter = () => {
    if (!isCompact) return;
    if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);

    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // Keep flyout safely within viewport height
      const clampedTop = Math.min(rect.top - 8, window.innerHeight - 320);
      setFlyoutTop(Math.max(16, clampedTop));
    }
    setShowFlyout(true);
  };

  const handleMouseLeave = () => {
    if (!isCompact) return;
    leaveTimeoutRef.current = setTimeout(() => {
      setShowFlyout(false);
    }, 150);
  };

  const handleCompactClick = () => {
    if (defaultPath) {
      navigate(defaultPath);
      setShowFlyout(false);
    } else {
      setShowFlyout((prev) => !prev);
    }
  };

  // When sidebar is collapsed, show compact icon with direct click navigation & floating flyout
  if (isCompact) {
    return (
      <div
        className="relative py-1 flex justify-center"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          ref={buttonRef}
          type="button"
          onClick={handleCompactClick}
          title={`${label}${defaultPath ? ' (Klik untuk buka)' : ''}`}
          aria-label={label}
          className={`
            group relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-500
            transition duration-[var(--duration-fast)] ease-[var(--ease-out)]
            hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95
            ${
              isChildActive
                ? 'bg-blue-50 font-semibold text-blue-700 ring-1 ring-blue-200/60 shadow-2xs'
                : ''
            }
          `}
        >
          {isChildActive && (
            <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-blue-600" />
          )}
          <span
            className={`h-5 w-5 transition-colors ${
              isChildActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-700'
            }`}
          >
            {icon}
          </span>
        </button>

        {/* Floating Flyout Submenu in Compact Mode */}
        {showFlyout && (
          <div
            style={{ top: `${flyoutTop}px` }}
            className="fixed left-[4.8rem] z-[100] w-56 rounded-2xl border border-slate-200/90 bg-white/95 p-2 shadow-xl shadow-slate-900/10 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {label}
              </span>
              {defaultPath && (
                <button
                  type="button"
                  onClick={() => {
                    navigate(defaultPath);
                    setShowFlyout(false);
                  }}
                  className="text-[11px] font-semibold text-blue-600 hover:underline"
                >
                  Buka &rarr;
                </button>
              )}
            </div>

            <div
              className="space-y-0.5"
              onClick={() => setShowFlyout(false)}
            >
              {children}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-1">
      {/* Group Header Row */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className={`
          group flex w-full items-center justify-between rounded-xl px-3 py-2 text-[13.5px]
          transition duration-[var(--duration-fast)] ease-[var(--ease-out)]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
          ${
            isChildActive
              ? 'font-semibold text-slate-900'
              : 'font-medium text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
          }
        `}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`h-5 w-5 flex-shrink-0 transition-colors ${
              isChildActive
                ? 'text-blue-600'
                : 'text-slate-400 group-hover:text-slate-600'
            }`}
          >
            {icon}
          </span>
          <span className="truncate">{label}</span>
        </div>

        <ChevronRightIcon
          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-[var(--duration-normal)] ease-[var(--ease-out)] group-hover:text-slate-600 ${
            isOpen ? 'rotate-90' : 'rotate-0'
          }`}
        />
      </button>

      {/* Sub-items Tree Branch Container */}
      <div
        className={`
          overflow-hidden transition-all duration-[var(--duration-normal)] ease-[var(--ease-out)]
          ${isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}
        `}
      >
        <div className="relative ml-[1.35rem] my-1 space-y-0.5 border-l border-slate-200/90 pl-2.5">
          {children}
        </div>
      </div>
    </div>
  );
}

