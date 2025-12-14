import {
  render,
  screen,
  fireEvent,
  cleanup,
} from '@testing-library/react';
import ActionButton from '../../../src/components/ui/ActionButton';

describe('ActionButton', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders children correctly', () => {
    render(<ActionButton onClick={() => {}}>Click Me</ActionButton>);
    expect(screen.getByText('Click Me')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = vi.fn();
    render(
      <ActionButton onClick={handleClick}>Click Me</ActionButton>
    );

    fireEvent.click(screen.getByText('Click Me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows loading state', () => {
    render(
      <ActionButton onClick={() => {}} isLoading>
        Click Me
      </ActionButton>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Click Me')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('handles disabled state', () => {
    const handleClick = vi.fn();
    render(
      <ActionButton onClick={handleClick} disabled>
        Click Me
      </ActionButton>
    );

    expect(screen.getByRole('button')).toBeDisabled();

    fireEvent.click(screen.getByText('Click Me'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies variant classes', () => {
    render(
      <ActionButton onClick={() => {}} variant="danger">
        Delete
      </ActionButton>
    );

    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-red-50');
    expect(button.className).toContain('text-red-700');
  });
});
