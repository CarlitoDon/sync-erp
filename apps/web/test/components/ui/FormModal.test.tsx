import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FormModal from '@/components/ui/FormModal';

describe('FormModal', () => {
  it('renders title, content, and close X button when open', () => {
    const onClose = vi.fn();
    render(
      <FormModal isOpen={true} onClose={onClose} title="Modal Title">
        <div>Modal Content Body</div>
      </FormModal>
    );

    expect(screen.getByText('Modal Title')).toBeInTheDocument();
    expect(screen.getByText('Modal Content Body')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /tutup modal/i });
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop overlay is clicked and disableBackdropClick is false', () => {
    const onClose = vi.fn();
    const { container } = render(
      <FormModal isOpen={true} onClose={onClose} title="Modal Title">
        <div>Content</div>
      </FormModal>
    );

    // Overlay is the first element with aria-hidden="true" and transition-opacity
    const overlay = container.querySelector('.fixed.inset-0.transition-opacity');
    expect(overlay).not.toBeNull();
    if (overlay) {
      fireEvent.click(overlay);
    }
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClose when backdrop overlay is clicked and disableBackdropClick is true', () => {
    const onClose = vi.fn();
    const { container } = render(
      <FormModal
        isOpen={true}
        onClose={onClose}
        title="Modal Title"
        disableBackdropClick={true}
      >
        <div>Content</div>
      </FormModal>
    );

    const overlay = container.querySelector('.fixed.inset-0.transition-opacity');
    expect(overlay).not.toBeNull();
    if (overlay) {
      fireEvent.click(overlay);
    }
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <FormModal isOpen={true} onClose={onClose} title="Modal Title">
        <div>Content</div>
      </FormModal>
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

