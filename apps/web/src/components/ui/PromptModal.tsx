import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
  KeyboardEvent,
} from 'react';

export interface PromptOptions {
  /** Title of the modal dialog */
  title?: string;
  /** Message/question to display */
  message: string;
  /** Placeholder text for the input field */
  placeholder?: string;
  /** Default value for the input */
  defaultValue?: string;
  /** Whether input is required (non-empty) */
  required?: boolean;
  /** Use textarea instead of input */
  multiline?: boolean;
  /** Maximum character length */
  maxLength?: number;
  /** Label for the submit button */
  submitText?: string;
  /** Label for the cancel button */
  cancelText?: string;
}

interface PromptContextType {
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const PromptContext = createContext<PromptContextType | null>(null);

interface PromptModalState extends PromptOptions {
  isOpen: boolean;
  resolve: ((value: string | null) => void) | null;
}

export function PromptProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PromptModalState>({
    isOpen: false,
    message: '',
    resolve: null,
  });
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const prompt = useCallback(
    (options: PromptOptions): Promise<string | null> => {
      return new Promise((resolve) => {
        setInputValue(options.defaultValue || '');
        setState({
          isOpen: true,
          ...options,
          resolve,
        });
      });
    },
    []
  );

  // Auto-focus input when modal opens
  useEffect(() => {
    if (state.isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [state.isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (state.isOpen && e.key === 'Escape') {
        handleCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state.isOpen]);

  const handleSubmit = () => {
    const trimmedValue = inputValue.trim();

    // If required and empty, don't submit
    if (state.required && !trimmedValue) {
      inputRef.current?.focus();
      return;
    }

    state.resolve?.(trimmedValue || null);
    setState((prev) => ({ ...prev, isOpen: false }));
    setInputValue('');
  };

  const handleCancel = () => {
    state.resolve?.(null);
    setState((prev) => ({ ...prev, isOpen: false }));
    setInputValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // Submit on Enter (unless multiline)
    if (e.key === 'Enter' && !state.multiline) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Focus trap - keep focus within modal
  const handleFocusTrap = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
      'input, textarea, button, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement?.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement?.focus();
    }
  };

  const isSubmitDisabled = state.required && !inputValue.trim();

  return (
    <PromptContext.Provider value={{ prompt }}>
      {children}

      {/* Modal Overlay */}
      {state.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="prompt-title"
          onKeyDown={handleFocusTrap}
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={handleCancel}
            aria-hidden="true"
          />

          {/* Modal */}
          <div
            ref={modalRef}
            className="relative z-10 w-full max-w-md transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all"
          >
            {/* Header */}
            <div className="px-6 pt-6">
              <h3
                id="prompt-title"
                className="text-lg font-semibold text-gray-900"
              >
                {state.title || 'Enter Value'}
              </h3>
            </div>

            {/* Body */}
            <div className="px-6 py-4">
              <label className="block text-gray-600 mb-3">
                {state.message}
              </label>

              {state.multiline ? (
                <textarea
                  ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={state.placeholder}
                  maxLength={state.maxLength}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                  aria-required={state.required}
                />
              ) : (
                <input
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={state.placeholder}
                  maxLength={state.maxLength}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  aria-required={state.required}
                />
              )}

              {/* Character count if maxLength */}
              {state.maxLength && (
                <p className="mt-1 text-xs text-gray-500 text-right">
                  {inputValue.length}/{state.maxLength}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 bg-gray-50 px-6 py-4">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                {state.cancelText || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitDisabled}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {state.submitText || 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PromptContext.Provider>
  );
}

/**
 * Hook to display a promise-based prompt modal.
 *
 * @returns Function to display prompt and get user input
 *
 * @example
 * const prompt = usePrompt();
 * const reason = await prompt({
 *   message: 'Why are you canceling?',
 *   required: true
 * });
 * if (reason) {
 *   // User submitted a value
 * }
 */
export function usePrompt() {
  const context = useContext(PromptContext);
  if (!context) {
    throw new Error('usePrompt must be used within a PromptProvider');
  }
  return context.prompt;
}
