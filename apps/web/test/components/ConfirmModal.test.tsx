import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import {
  ConfirmProvider,
  useConfirm,
} from '../../src/components/ConfirmModal';

// Test component that uses the confirm hook
function TestComponent({
  options,
}: {
  options?: Parameters<ReturnType<typeof useConfirm>>[0];
}) {
  const confirm = useConfirm();

  const handleClick = async () => {
    const result = await confirm(
      options || { message: 'Are you sure?' }
    );
    // Store result in a data attribute for testing
    document.body.setAttribute('data-confirm-result', String(result));
  };

  return <button onClick={handleClick}>Open Confirm</button>;
}

describe('ConfirmModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.removeAttribute('data-confirm-result');
  });

  const renderWithProvider = (
    options?: Parameters<ReturnType<typeof useConfirm>>[0]
  ) => {
    return render(
      <ConfirmProvider>
        <TestComponent options={options} />
      </ConfirmProvider>
    );
  };

  describe('useConfirm hook', () => {
    it('throws error when used outside ConfirmProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useConfirm must be used within a ConfirmProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('Modal Display', () => {
    it('does not show modal initially', () => {
      renderWithProvider();

      expect(
        screen.queryByText('Confirm Action')
      ).not.toBeInTheDocument();
    });

    it('shows modal when confirm is called', async () => {
      renderWithProvider();

      fireEvent.click(screen.getByText('Open Confirm'));

      await waitFor(() => {
        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
      });
    });

    it('displays custom title', async () => {
      renderWithProvider({
        message: 'Delete item?',
        title: 'Delete Confirmation',
      });

      fireEvent.click(screen.getByText('Open Confirm'));

      await waitFor(() => {
        expect(
          screen.getByText('Delete Confirmation')
        ).toBeInTheDocument();
      });
    });

    it('displays default title when not provided', async () => {
      renderWithProvider({ message: 'Test message' });

      fireEvent.click(screen.getByText('Open Confirm'));

      await waitFor(() => {
        expect(
          screen.getByText('Confirm Action')
        ).toBeInTheDocument();
      });
    });

    it('displays custom confirm text', async () => {
      renderWithProvider({
        message: 'Delete?',
        confirmText: 'Yes, Delete',
      });

      fireEvent.click(screen.getByText('Open Confirm'));

      await waitFor(() => {
        expect(screen.getByText('Yes, Delete')).toBeInTheDocument();
      });
    });

    it('displays custom cancel text', async () => {
      renderWithProvider({
        message: 'Delete?',
        cancelText: 'No, Keep It',
      });

      fireEvent.click(screen.getByText('Open Confirm'));

      await waitFor(() => {
        expect(screen.getByText('No, Keep It')).toBeInTheDocument();
      });
    });

    it('displays default button texts when not provided', async () => {
      renderWithProvider({ message: 'Test' });

      fireEvent.click(screen.getByText('Open Confirm'));

      await waitFor(() => {
        expect(screen.getByText('Confirm')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });
    });
  });

  describe('User Actions', () => {
    it('resolves true when confirm button is clicked', async () => {
      renderWithProvider({ message: 'Confirm this?' });

      fireEvent.click(screen.getByText('Open Confirm'));

      await waitFor(() => {
        expect(screen.getByText('Confirm')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(
          document.body.getAttribute('data-confirm-result')
        ).toBe('true');
      });
    });

    it('resolves false when cancel button is clicked', async () => {
      renderWithProvider({ message: 'Confirm this?' });

      fireEvent.click(screen.getByText('Open Confirm'));

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(
          document.body.getAttribute('data-confirm-result')
        ).toBe('false');
      });
    });

    it('closes modal after confirm', async () => {
      renderWithProvider({ message: 'Confirm this?' });

      fireEvent.click(screen.getByText('Open Confirm'));

      await waitFor(() => {
        expect(screen.getByText('Confirm this?')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(
          screen.queryByText('Confirm this?')
        ).not.toBeInTheDocument();
      });
    });

    it('closes modal after cancel', async () => {
      renderWithProvider({ message: 'Cancel this?' });

      fireEvent.click(screen.getByText('Open Confirm'));

      await waitFor(() => {
        expect(screen.getByText('Cancel this?')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(
          screen.queryByText('Cancel this?')
        ).not.toBeInTheDocument();
      });
    });

    it('closes modal when clicking backdrop', async () => {
      renderWithProvider({ message: 'Backdrop test' });

      fireEvent.click(screen.getByText('Open Confirm'));

      await waitFor(() => {
        expect(screen.getByText('Backdrop test')).toBeInTheDocument();
      });

      // Find and click the backdrop (the div with bg-black/50)
      const backdrop = document.querySelector('.bg-black\\/50');
      expect(backdrop).toBeTruthy();
      fireEvent.click(backdrop!);

      await waitFor(() => {
        expect(
          screen.queryByText('Backdrop test')
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Variant Styling', () => {
    it('applies danger variant styles', async () => {
      renderWithProvider({ message: 'Delete?', variant: 'danger' });

      fireEvent.click(screen.getByText('Open Confirm'));

      await waitFor(() => {
        const confirmBtn = screen.getByText('Confirm');
        expect(confirmBtn).toHaveClass('bg-red-600');
      });
    });

    it('applies warning variant styles', async () => {
      renderWithProvider({ message: 'Warning?', variant: 'warning' });

      fireEvent.click(screen.getByText('Open Confirm'));

      await waitFor(() => {
        const confirmBtn = screen.getByText('Confirm');
        expect(confirmBtn).toHaveClass('bg-amber-600');
      });
    });

    it('applies primary variant styles by default', async () => {
      renderWithProvider({ message: 'Default?' });

      fireEvent.click(screen.getByText('Open Confirm'));

      await waitFor(() => {
        const confirmBtn = screen.getByText('Confirm');
        expect(confirmBtn).toHaveClass('bg-primary-600');
      });
    });
  });
});
