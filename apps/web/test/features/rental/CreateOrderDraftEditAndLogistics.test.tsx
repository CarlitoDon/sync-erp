import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CreateOrderModal from '@/features/rental/modals/CreateOrderModal';
import {
  parseOrderToFormState,
  type EditableRentalOrder,
} from '@/features/rental/hooks/useCreateOrder';

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
      rental: { orders: { list: { invalidate: vi.fn() }, getById: { invalidate: vi.fn() } } },
    }),
    partner: {
      create: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      listAddresses: { useQuery: () => ({ data: [] }) },
    },
    maps: {
      extractFromUrl: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
      searchPlaces: { useQuery: () => ({ data: [], isFetching: false }) },
    },
    rental: {
      policy: {
        get: {
          useQuery: () => ({
            data: {
              upstairsFeePerUnit: 3500,
              fittedSheetFeePerUnit: 2000,
            },
          }),
        },
      },
      orders: {
        update: {
          useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
        },
      },
    },
  },
}));

describe('CreateOrderModal - Draft Editing & Logistics Integration', () => {
  describe('parseOrderToFormState', () => {
    it('returns clean defaults when order is null or undefined', () => {
      const state = parseOrderToFormState(null);
      expect(state.partnerId).toBe('');
      expect(state.deliveryTime).toBe('07:00');
      expect(state.pickupTime).toBe('18:00');
      expect(state.upstairsMattressCount).toBe('');
      expect(state.fittedSheetCount).toBe('');
      expect(state.items).toEqual([]);
    });

    it('correctly parses an existing draft order with notes, logistics, and items', () => {
      const mockOrder: EditableRentalOrder = {
        id: 'ord-123',
        orderNumber: 'ORD-2026-001',
        partnerId: 'partner-99',
        rentalStartDate: '2026-10-01T07:00:00.000Z',
        rentalEndDate: '2026-10-05T18:00:00.000Z',
        notes: [
          'Jam antar: 08:30',
          'Jam ambil: 19:00',
          'Kasur naik ke lantai 2: 2',
          'Kasur dipasang sprei: 2',
          'Ongkos kirim dasar: Rp 20.000',
          'Titik Google Maps: https://maps.app.goo.gl/xyz123',
          'Catatan tambahan untuk kurir',
        ].join('\n'),
        deliveryFee: 31000, // 20000 base + (2 * 3500) + (2 * 2000)
        discountAmount: 5000,
        depositAmount: 50000,
        street: 'Jl. Kaliurang KM 5',
        kelurahan: 'Caturtunggal',
        kecamatan: 'Depok',
        kota: 'Sleman',
        provinsi: 'DIY',
        zip: '55281',
        latitude: -7.76,
        longitude: 110.38,
        items: [
          { rentalItemId: 'ri-1', quantity: 2, unitPrice: 50000 },
        ],
      };

      const state = parseOrderToFormState(mockOrder);

      expect(state.partnerId).toBe('partner-99');
      expect(state.rentalStartDate).toBe('2026-10-01');
      expect(state.rentalEndDate).toBe('2026-10-05');
      expect(state.deliveryTime).toBe('08:30');
      expect(state.pickupTime).toBe('19:00');
      expect(state.upstairsMattressCount).toBe('2');
      expect(state.fittedSheetCount).toBe('2');
      expect(state.deliveryFee).toBe('20000');
      expect(state.discountAmount).toBe('5000');
      expect(state.requiresDeposit).toBe(true);
      expect(state.depositAmount).toBe('50000');
      expect(state.notes).toBe('Catatan tambahan untuk kurir');
      expect(state.googleMapsUrl).toBe('https://maps.app.goo.gl/xyz123');
      expect(state.street).toBe('Jl. Kaliurang KM 5');
      expect(state.latitude).toBe(-7.76);
      expect(state.longitude).toBe(110.38);
      expect(state.items).toHaveLength(1);
      expect(state.items[0]).toEqual({
        type: 'item',
        rentalItemId: 'ri-1',
        rentalBundleId: undefined,
        quantity: 2,
        pricePerDay: 50000,
      });
    });
  });

  describe('CreateOrderModal Edit Mode UI', () => {
    it('displays edit header and update button when editingOrder is provided', () => {
      mockUseCreateOrder.mockReturnValue({
        rentalItems: [],
        rentalBundles: [],
        customers: [{ id: 'cust-1', name: 'Siti Rahma' }],
        partnerAddresses: [],
        isLoadingData: false,
        rentalDays: 2,
        subtotal: 100000,
        totalMattressesInOrder: 2,
        stockConflicts: [],
        hasStockError: false,
        getDynamicRemainingForLine: vi.fn().mockReturnValue(10),
        upstairsFeePerUnit: 3500,
        fittedSheetFeePerUnit: 2000,
        upstairsTotalFee: 7000,
        fittedSheetTotalFee: 4000,
        specialServicesTotalFee: 11000,
        orderForm: {
          partnerId: 'cust-1',
          rentalStartDate: '2026-10-01',
          deliveryTime: '07:00',
          rentalEndDate: '2026-10-03',
          pickupTime: '18:00',
          dueDateTime: '',
          notes: '',
          deliveryFee: '20000',
          discountAmount: '',
          deliveryAddress: 'Jl. Palagan No. 5',
          street: 'Jl. Palagan No. 5',
          kelurahan: '',
          kecamatan: '',
          kota: 'Sleman',
          provinsi: 'DIY',
          zip: '',
          latitude: null,
          longitude: null,
          saveToCustomerAddresses: false,
          selectedCustomerAddressId: '',
          requiresDeposit: false,
          depositAmount: '',
          upstairsMattressCount: '2',
          fittedSheetCount: '2',
          googleMapsUrl: '',
          items: [{ type: 'item', rentalItemId: 'ri-1', quantity: 2 }],
        },
        updateFormField: vi.fn(),
        isQuickCreateOpen: false,
        setIsQuickCreateOpen: vi.fn(),
        isDirty: true,
        isEditing: true,
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
        getAvailableUnits: vi.fn().mockReturnValue(10),
        getBundleAvailableUnits: vi.fn().mockReturnValue(0),
        handleQuickCreateSuccess: vi.fn(),
      });

      const editingOrder: EditableRentalOrder = {
        id: 'ord-123',
        orderNumber: 'ORD-2026-001',
        rentalStartDate: '2026-10-01',
        rentalEndDate: '2026-10-03',
      };

      render(
        <CreateOrderModal
          isOpen={true}
          editingOrder={editingOrder}
          onClose={vi.fn()}
        />
      );

      // Title must reflect editing draft order with number
      expect(screen.getByText('Edit Order Draft #ORD-2026-001')).toBeInTheDocument();
      // Button must show update text
      expect(screen.getByRole('button', { name: /Perbarui Order Draft/i })).toBeInTheDocument();

      // Special services breakdown must be visible in preview
      expect(screen.getByText('Layanan Khusus & Logistik')).toBeInTheDocument();
      expect(screen.getByText(/Layanan Naik Lantai Atas \(2 kasur\)/)).toBeInTheDocument();
      expect(screen.getByText(/Layanan Pasang Sprei \(2 kasur\)/)).toBeInTheDocument();
    });

    it('renders stock conflict banner and disables submit when cross-inventory conflict exists', () => {
      mockUseCreateOrder.mockReturnValue({
        rentalItems: [],
        rentalBundles: [],
        customers: [],
        partnerAddresses: [],
        isLoadingData: false,
        rentalDays: 1,
        subtotal: 500000,
        totalMattressesInOrder: 14,
        stockConflicts: [
          {
            rentalItemId: 'kasur-90',
            productName: 'Kasur Busa 90x200',
            availableUnits: 13,
            totalDemand: 14,
            shortage: 1,
            message:
              'Kasur Busa 90x200: Total kebutuhan (14 unit) melebihi stok tersedia (13 unit). [Paket 90 x 13: butuh 13 unit, Kasur Busa 90 x 1: butuh 1 unit]',
            breakdowns: [
              { sourceName: 'Paket 90 (Bundle)', sourceQuantity: 13, multiplier: 1, requiredUnits: 13 },
              { sourceName: 'Kasur Busa 90 (Satuan)', sourceQuantity: 1, multiplier: 1, requiredUnits: 1 },
            ],
          },
        ],
        hasStockError: true,
        getDynamicRemainingForLine: vi.fn().mockReturnValue(0),
        upstairsFeePerUnit: 3500,
        fittedSheetFeePerUnit: 2000,
        upstairsTotalFee: 0,
        fittedSheetTotalFee: 0,
        specialServicesTotalFee: 0,
        orderForm: {
          partnerId: '',
          rentalStartDate: '2026-10-01',
          deliveryTime: '07:00',
          rentalEndDate: '2026-10-02',
          pickupTime: '18:00',
          dueDateTime: '',
          notes: '',
          deliveryFee: '',
          discountAmount: '',
          deliveryAddress: '',
          street: '',
          kelurahan: '',
          kecamatan: '',
          kota: '',
          provinsi: '',
          zip: '',
          latitude: null,
          longitude: null,
          saveToCustomerAddresses: false,
          selectedCustomerAddressId: '',
          requiresDeposit: false,
          depositAmount: '',
          upstairsMattressCount: '',
          fittedSheetCount: '',
          googleMapsUrl: '',
          items: [{ type: 'item', rentalItemId: 'ri-1', quantity: 14 }],
        },
        updateFormField: vi.fn(),
        isQuickCreateOpen: false,
        setIsQuickCreateOpen: vi.fn(),
        isDirty: true,
        isEditing: false,
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
        getAvailableUnits: vi.fn().mockReturnValue(13),
        getBundleAvailableUnits: vi.fn().mockReturnValue(13),
        handleQuickCreateSuccess: vi.fn(),
      });

      render(
        <CreateOrderModal
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      // Warning banner must be visible
      expect(screen.getByText('Konflik Stok Inventaris (Kapasitas Gudang Terlampaui)')).toBeInTheDocument();
      expect(
        screen.getByText(
          /Kasur Busa 90x200: Total kebutuhan \(14 unit\) melebihi stok tersedia \(13 unit\)/
        )
      ).toBeInTheDocument();

      // Submit button must be disabled
      const submitBtn = screen.getByRole('button', { name: /Simpan Order Draft/i });
      expect(submitBtn).toBeDisabled();
    });
  });
});
