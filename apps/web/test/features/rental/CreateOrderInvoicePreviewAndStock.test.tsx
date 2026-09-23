import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CreateOrderModal from '@/features/rental/modals/CreateOrderModal';
import { calculateLineTotal } from '@/features/rental/hooks/useRentalPricing';

const mockUseCreateOrder = vi.fn();

vi.mock('@/features/rental/hooks', async () => {
  const actual = await vi.importActual<typeof import('@/features/rental/hooks')>(
    '@/features/rental/hooks'
  );
  return {
    ...actual,
    useCreateOrder: (...args: unknown[]) => mockUseCreateOrder(...args),
  };
});

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      maps: { reverseGeocode: { fetch: vi.fn() } },
      partner: { list: { invalidate: vi.fn() } },
    }),
    partner: {
      create: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      listAddresses: { useQuery: () => ({ data: [] }) },
    },
    maps: {
      extractFromUrl: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      searchPlaces: { useQuery: () => ({ data: [], isFetching: false }) },
    },
  },
}));

describe('CreateOrderModal - Category, Stock Range & Invoice Preview', () => {
  it('correctly calculates line totals and pricing tier', () => {
    const item = { rentalItemId: 'item-1', quantity: 2 };
    const rentalItems = [
      {
        id: 'item-1',
        dailyRate: 50000,
        weeklyRate: 300000,
        monthlyRate: 1000000,
        product: { name: 'Kasur Busa 160x200' },
      },
    ];
    const rentalBundles: { id: string; dailyRate: number; weeklyRate: number; monthlyRate: number }[] = [];

    // 3 days: daily rate (50,000 * 3 = 150,000 per unit * 2 = 300,000)
    const res3Days = calculateLineTotal(item, rentalItems, rentalBundles, 3);
    expect(res3Days.name).toBe('Kasur Busa 160x200');
    expect(res3Days.unitPrice).toBe(150000);
    expect(res3Days.lineTotal).toBe(300000);

    // 7 days: weekly tier (300,000 per unit * 2 = 600,000 instead of 50,000 * 7 = 350,000 * 2 = 700,000)
    const res7Days = calculateLineTotal(item, rentalItems, rentalBundles, 7);
    expect(res7Days.unitPrice).toBe(300000);
    expect(res7Days.lineTotal).toBe(600000);
  });

  it('renders invoice preview card with draft badge, customer, period, and itemized table', () => {
    mockUseCreateOrder.mockReturnValue({
      rentalItems: [
        {
          id: 'item-160',
          category: 'MATTRESS',
          dailyRate: 60000,
          weeklyRate: 350000,
          monthlyRate: 1200000,
          product: { name: 'Kasur 160x200' },
          units: [{ id: 'u1', status: 'AVAILABLE' }],
        },
      ],
      rentalBundles: [],
      customers: [{ id: 'cust-1', name: 'Budi Santoso', phone: '081298765432' }],
      partnerAddresses: [],
      isLoadingData: false,
      rentalDays: 3,
      subtotal: 180000,
      orderForm: {
        partnerId: 'cust-1',
        rentalStartDate: '2026-09-24',
        deliveryTime: '07:00',
        rentalEndDate: '2026-09-27',
        pickupTime: '18:00',
        dueDateTime: '',
        notes: 'Titip di satpam jika belum di rumah',
        deliveryFee: '25000',
        discountAmount: '10000',
        deliveryAddress: 'Jl. Malioboro No. 12, Yogyakarta',
        street: 'Jl. Malioboro No. 12',
        city: 'Yogyakarta',
        state: 'DIY',
        zip: '55271',
        latitude: null,
        longitude: null,
        saveToCustomerAddresses: false,
        saveAsDefaultAddress: false,
        addressName: '',
        selectedCustomerAddressId: '',
        requiresDeposit: true,
        depositAmount: '100000',
        upstairsMattressCount: '',
        fittedSheetCount: '',
        googleMapsUrl: 'https://maps.google.com/?q=-7.79,110.36',
        items: [{ type: 'item', rentalItemId: 'item-160', quantity: 1 }],
      },
      updateFormField: vi.fn(),
      isQuickCreateOpen: false,
      setIsQuickCreateOpen: vi.fn(),
      isDirty: false,
      isCreating: false,
      handleClose: vi.fn(),
      handleSubmit: vi.fn(),
      addItem: vi.fn(),
      updateItem: vi.fn(),
      updateItemUnified: vi.fn(),
      updateItemQuantity: vi.fn(),
      applyLocationData: vi.fn(),
      selectSavedAddress: vi.fn(),
      removeItem: vi.fn(),
      getAvailableUnits: vi.fn().mockReturnValue(8),
      getBundleAvailableUnits: vi.fn().mockReturnValue(0),
      handleQuickCreateSuccess: vi.fn(),
    });

    render(
      <CreateOrderModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Header & Badge
    expect(screen.getByText('Ringkasan Pesanan (Invoice Preview)')).toBeInTheDocument();
    expect(screen.getByText('Draft Preview')).toBeInTheDocument();

    // Customer & destination
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText('081298765432')).toBeInTheDocument();
    expect(screen.getByText('Jl. Malioboro No. 12, Yogyakarta')).toBeInTheDocument();

    // Rental period
    expect(screen.getByText(/2026-09-24 \(07:00\) s\/d 2026-09-27 \(18:00\)/)).toBeInTheDocument();

    // Notes appears in textarea and preview invoice
    expect(screen.getAllByText(/Titip di satpam jika belum di rumah/).length).toBeGreaterThanOrEqual(1);

    // Pricing Breakdown: Subtotal 180k, Ongkir 25k, Diskon 10k, Total 195k (180+25-10)
    expect(screen.getByText(/Total Tagihan/)).toBeInTheDocument();
    expect(screen.getAllByText('Rp 195.000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Deposit / Uang Jaminan (Terpisah)')).toBeInTheDocument();
    expect(screen.getByText('Rp 100.000')).toBeInTheDocument();
  });

  it('disables submit button and shows error if requested quantity exceeds available stock', () => {
    mockUseCreateOrder.mockReturnValue({
      rentalItems: [
        {
          id: 'item-160',
          category: 'MATTRESS',
          dailyRate: 60000,
          product: { name: 'Kasur 160x200' },
          units: [],
        },
      ],
      rentalBundles: [],
      customers: [{ id: 'cust-1', name: 'Budi Santoso', phone: '081298765432' }],
      partnerAddresses: [],
      isLoadingData: false,
      rentalDays: 3,
      subtotal: 1800000,
      orderForm: {
        partnerId: 'cust-1',
        rentalStartDate: '2026-09-24',
        rentalEndDate: '2026-09-27',
        deliveryAddress: 'Jl. Malioboro',
        latitude: null,
        longitude: null,
        // User requested 10 units of Kasur 160x200, but only 8 are available!
        items: [{ type: 'item', rentalItemId: 'item-160', quantity: 10 }],
      },
      updateFormField: vi.fn(),
      isQuickCreateOpen: false,
      setIsQuickCreateOpen: vi.fn(),
      isDirty: false,
      isCreating: false,
      handleClose: vi.fn(),
      handleSubmit: vi.fn(),
      addItem: vi.fn(),
      updateItem: vi.fn(),
      updateItemUnified: vi.fn(),
      updateItemQuantity: vi.fn(),
      applyLocationData: vi.fn(),
      selectSavedAddress: vi.fn(),
      removeItem: vi.fn(),
      // Inventory only has 8 units
      getAvailableUnits: vi.fn().mockReturnValue(8),
      getBundleAvailableUnits: vi.fn().mockReturnValue(0),
      handleQuickCreateSuccess: vi.fn(),
    });

    render(
      <CreateOrderModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Stock warning badge should display max 8
    expect(screen.getByText('Maks 8 unit')).toBeInTheDocument();

    // The submit button must be disabled
    const submitBtn = screen.getByRole('button', { name: /Simpan Order Draft/i });
    expect(submitBtn).toBeDisabled();
  });
});
