import { useNavigate } from 'react-router-dom';

interface BackButtonProps {
  /** Target path to navigate to. If not provided, uses browser history (-1) */
  to?: string;
}

/**
 * Consistent back button component for all detail pages.
 * Apple-like design with circular hover state.
 */
export function BackButton({ to }: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
      style={{ cursor: 'pointer' }}
      aria-label="Go back"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        className="w-6 h-6"
        style={{ pointerEvents: 'none' }}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
        />
      </svg>
    </button>
  );
}
