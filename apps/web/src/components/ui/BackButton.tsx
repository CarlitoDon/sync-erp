import { useNavigate } from 'react-router-dom';

interface BackButtonProps {
  /** Target path to navigate to. If not provided, uses browser history (-1) */
  to?: string;
}

/**
 * Consistent back button component for all detail pages.
 * Apple-like design with just arrow icon.
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
      className="inline-flex items-center justify-center w-8 h-8 -ml-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      style={{ cursor: 'pointer' }}
      aria-label="Go back"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        className="w-5 h-5"
        style={{ pointerEvents: 'none' }}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 19.5L8.25 12l7.5-7.5"
        />
      </svg>
    </button>
  );
}
