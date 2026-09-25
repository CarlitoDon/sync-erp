import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Select from '@/components/ui/Select';

describe('Select Component', () => {
  const options = [
    { value: 'cust-1', label: 'Bambang Hermanto (0812-3456-7890)' },
    { value: 'cust-2', label: 'Dewi Sartika (0818-7654-3210)' },
    { value: 'cust-3', label: 'Ahmad Yani (0813-1122-3344)' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders trigger button with placeholder when no value is selected', () => {
    render(
      <Select
        value=""
        onChange={vi.fn()}
        options={options}
        placeholder="Pilih customer..."
      />
    );

    expect(screen.getByTestId('select-trigger')).toHaveTextContent('Pilih customer...');
  });

  it('renders selected option label when value matches', () => {
    render(
      <Select
        value="cust-1"
        onChange={vi.fn()}
        options={options}
        placeholder="Pilih customer..."
      />
    );

    expect(screen.getByTestId('select-trigger')).toHaveTextContent('Bambang Hermanto');
  });

  it('opens dropdown on click without throwing or scrolling', async () => {
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus');

    render(
      <Select
        value=""
        onChange={vi.fn()}
        options={options}
        placeholder="Pilih customer..."
        portal={false}
      />
    );

    const trigger = screen.getByTestId('select-trigger');
    fireEvent.click(trigger);

    expect(screen.getByPlaceholderText('Cari...')).toBeInTheDocument();
    expect(screen.getByText('Bambang Hermanto (0812-3456-7890)')).toBeInTheDocument();

    // Verify focus was called with preventScroll: true
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });

    focusSpy.mockRestore();
  });

  it('filters options when search term is entered', () => {
    render(
      <Select
        value=""
        onChange={vi.fn()}
        options={options}
        placeholder="Pilih customer..."
        portal={false}
      />
    );

    fireEvent.click(screen.getByTestId('select-trigger'));

    const searchInput = screen.getByPlaceholderText('Cari...');
    fireEvent.change(searchInput, { target: { value: 'Dewi' } });

    expect(screen.getByText('Dewi Sartika (0818-7654-3210)')).toBeInTheDocument();
    expect(screen.queryByText('Bambang Hermanto (0812-3456-7890)')).not.toBeInTheDocument();
  });

  it('calls onChange with selected value and closes dropdown', () => {
    const onChange = vi.fn();
    render(
      <Select
        value=""
        onChange={onChange}
        options={options}
        placeholder="Pilih customer..."
        portal={false}
      />
    );

    fireEvent.click(screen.getByTestId('select-trigger'));
    fireEvent.click(screen.getByText('Dewi Sartika (0818-7654-3210)'));

    expect(onChange).toHaveBeenCalledWith('cust-2');
    expect(screen.queryByPlaceholderText('Cari...')).not.toBeInTheDocument();
  });

  it('closes on Escape key press and stops propagation to parent modal', () => {
    const parentKeyDown = vi.fn();
    render(
      <div onKeyDown={parentKeyDown}>
        <Select
          value=""
          onChange={vi.fn()}
          options={options}
          placeholder="Pilih customer..."
          portal={false}
        />
      </div>
    );

    fireEvent.click(screen.getByTestId('select-trigger'));
    expect(screen.getByPlaceholderText('Cari...')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByPlaceholderText('Cari...')).not.toBeInTheDocument();
    expect(parentKeyDown).not.toHaveBeenCalled();
  });

  it('closes when clicking outside container and dropdown', async () => {
    render(
      <div>
        <div data-testid="outside-area">Outside</div>
        <Select
          value=""
          onChange={vi.fn()}
          options={options}
          placeholder="Pilih customer..."
          portal={false}
        />
      </div>
    );

    fireEvent.click(screen.getByTestId('select-trigger'));
    expect(screen.getByPlaceholderText('Cari...')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('outside-area'));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Cari...')).not.toBeInTheDocument();
    });
  });
});
