import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import CreateOrderModal from '@/features/rental/modals/CreateOrderModal';

const mockUseCreateOrder = vi.fn();

vi.mock('@/features/rental/hooks', () => ({
  useCreateOrder: (...args: unknown[]) => mockUseCreateOrder(...args),
  getPricingTierLabel: () => 'Standard',
  calculateLineTotal: () => ({
    name: 'Kasur 160x200',
    unitPrice: 50000,
    dailyRate: 50000,
    lineTotal: 150000,
  }),
}));

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      maps: {
        reverseGeocode: { fetch: vi.fn() },
      },
      partner: {
        list: { invalidate: vi.fn() },
      },
    }),
    partner: {
      create: {
        useMutation: () => ({
          mutateAsync: vi.fn(),
          isPending: false,
        }),
      },
    },
    maps: {
      extractFromUrl: {
        useMutation: () => ({
          mutateAsync: vi.fn(),
          isPending: false,
        }),
      },
      searchPlaces: {
        useQuery: () => ({
          data: [],
          isFetching: false,
        }),
      },
    },
  },
}));

describe('CreateOrderModal - MapSelectorModal integration and focus management', () => {
  const defaultHookReturn = {
    rentalItems: [],
    rentalBundles: [],
    customers: [{ id: 'cust-1', name: 'John Doe', phone: '08123456789' }],
    partnerAddresses: [],
    isLoadingData: false,
    rentalDays: 3,
    subtotal: 150000,
    orderForm: {
      partnerId: 'cust-1',
      rentalStartDate: '2026-09-24',
      deliveryTime: '10:00',
      rentalEndDate: '2026-09-27',
      pickupTime: '10:00',
      dueDateTime: '',
      notes: '',
      deliveryFee: '20000',
      discountAmount: '0',
      deliveryAddress: 'Jl. Kaliurang KM 5',
      street: 'Jl. Kaliurang KM 5',
      kelurahan: '',
      kecamatan: '',
      kota: 'Sleman',
      provinsi: 'DIY',
      zip: '',
      latitude: -7.75,
      longitude: 110.38,
      saveToCustomerAddresses: false,
      selectedCustomerAddressId: '',
      requiresDeposit: false,
      depositAmount: '0',
      upstairsMattressCount: '0',
      fittedSheetCount: '0',
      googleMapsUrl: '',
      items: [{ type: 'item' as const, rentalItemId: 'item-1', quantity: 1 }],
    },
    updateFormField: vi.fn(),
    isQuickCreateOpen: false,
    setIsQuickCreateOpen: vi.fn(),
    isDirty: false,
    isCreating: false,
    handleClose: vi.fn(),
    handleSubmit: vi.fn((e: React.FormEvent) => e.preventDefault()),
    addItem: vi.fn(),
    updateItem: vi.fn(),
    updateItemUnified: vi.fn(),
    updateItemQuantity: vi.fn(),
    applyLocationData: vi.fn(),
    selectSavedAddress: vi.fn(),
    removeItem: vi.fn(),
    getAvailableUnits: vi.fn(() => 5),
    handleQuickCreateSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCreateOrder.mockReturnValue(defaultHookReturn);
  });

  it('blurs active element and opens MapSelectorModal with default z-[10000] when "Pilih di Peta" is clicked', () => {
    render(
      <CreateOrderModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Focus an active element first (e.g. Google Maps URL input)
    const urlInput = screen.getByPlaceholderText(/maps\.app\.goo\.gl/i);
    urlInput.focus();
    expect(document.activeElement).toBe(urlInput);

    const blurSpy = vi.spyOn(urlInput, 'blur');

    // Click "Pilih di Peta"
    const mapButton = screen.getByRole('button', { name: /pilih di peta/i });
    fireEvent.click(mapButton);

    // document.activeElement must be blurred to cleanly close any open select dropdowns
    expect(blurSpy).toHaveBeenCalled();

    // MapSelectorModal should be visible
    expect(
      screen.getByText('Pilih Titik Lokasi Pengantaran (Peta)')
    ).toBeInTheDocument();

    // MapSelectorModal dialog must have z-[10000] (higher than Select's z-[9999])
    const dialogs = screen.getAllByRole('dialog');
    const mapModalDialog = dialogs.find((d) =>
      d.className.includes('z-[10000]')
    );
    expect(mapModalDialog).toBeDefined();
    expect(mapModalDialog?.className).toContain('z-[10000]');
  });

  it('closes MapSelectorModal when Batal is clicked inside it', () => {
    render(
      <CreateOrderModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const mapButton = screen.getByRole('button', { name: /pilih di peta/i });
    fireEvent.click(mapButton);

    expect(
      screen.getByText('Pilih Titik Lokasi Pengantaran (Peta)')
    ).toBeInTheDocument();

    const dialogs = screen.getAllByRole('dialog');
    const mapModalDialog = dialogs.find((d) =>
      d.className.includes('z-[10000]')
    );
    expect(mapModalDialog).toBeDefined();

    const batalBtn = within(mapModalDialog!).getByRole('button', { name: /batal/i });
    fireEvent.click(batalBtn);

    expect(
      screen.queryByText('Pilih Titik Lokasi Pengantaran (Peta)')
    ).not.toBeInTheDocument();
  });

  it('applies selected location data when "Gunakan Lokasi Ini" is confirmed', () => {
    render(
      <CreateOrderModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const mapButton = screen.getByRole('button', { name: /pilih di peta/i });
    fireEvent.click(mapButton);

    const confirmBtn = screen.getByRole('button', { name: /gunakan lokasi ini/i });
    fireEvent.click(confirmBtn);

    expect(defaultHookReturn.applyLocationData).toHaveBeenCalled();
  });
});
