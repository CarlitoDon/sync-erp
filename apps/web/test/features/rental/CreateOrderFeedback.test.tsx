import { render, screen, fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import QuickCreateCustomerModal from '@/features/rental/modals/QuickCreateCustomerModal';
import MapSelectorModal from '@/features/rental/modals/MapSelectorModal';
import { useRentalPricing } from '@/features/rental/hooks/useRentalPricing';
import { DepositPolicyType } from '@sync-erp/shared';

// Mock trpc
const mockCreatePartnerMutateAsync = vi.fn();
const mockExtractFromUrlMutateAsync = vi.fn();
const mockReverseGeocodeFetch = vi.fn();

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      partner: {
        list: { invalidate: vi.fn() },
        listAddresses: { invalidate: vi.fn() },
      },
      maps: {
        reverseGeocode: { fetch: mockReverseGeocodeFetch },
      },
    }),
    partner: {
      create: {
        useMutation: () => ({
          mutateAsync: mockCreatePartnerMutateAsync,
          isPending: false,
        }),
      },
    },
    maps: {
      extractFromUrl: {
        useMutation: () => ({
          mutateAsync: mockExtractFromUrlMutateAsync,
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

vi.mock('@/hooks/useApiAction', () => ({
  apiAction: async (fn: () => Promise<unknown>) => fn(),
}));

describe('Customer & Rental Address Feedback Improvements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Feedback 3: Backspace-friendly quantity input & Pricing calculation', () => {
    it('handles empty string quantity gracefully without returning NaN in subtotal', () => {
      const items = [
        {
          rentalItemId: 'item-1',
          quantity: '' as const, // User backspaced and cleared the input
        },
      ];

      const rentalItems = [
        {
          id: 'item-1',
          dailyRate: 50000,
          weeklyRate: 250000,
          monthlyRate: 800000,
          depositPolicyType: DepositPolicyType.PERCENTAGE,
          depositPercentage: 50,
          depositPerUnit: 0,
        },
      ];

      const { result } = renderHook(() =>
        useRentalPricing(items, rentalItems, 3, [])
      );

      // Subtotal and deposit should treat empty string as 0 instead of NaN
      expect(result.current.subtotal).toBe(0);
      expect(result.current.depositRequired).toBe(0);
      expect(Number.isNaN(result.current.subtotal)).toBe(false);
      expect(Number.isNaN(result.current.depositRequired)).toBe(false);
    });

    it('calculates proper subtotal when quantity is filled', () => {
      const items = [
        {
          rentalItemId: 'item-1',
          quantity: 2,
        },
      ];

      const rentalItems = [
        {
          id: 'item-1',
          dailyRate: 50000,
          weeklyRate: 250000,
          monthlyRate: 800000,
          depositPolicyType: DepositPolicyType.PERCENTAGE,
          depositPercentage: 50,
          depositPerUnit: 0,
        },
      ];

      const { result } = renderHook(() =>
        useRentalPricing(items, rentalItems, 2, [])
      );

      // 50,000 * 2 days * 2 qty = 200,000
      expect(result.current.subtotal).toBe(200000);
      // 50% deposit = 100,000
      expect(result.current.depositRequired).toBe(100000);
    });
  });

  describe('Feedback 7: QuickCreateCustomerModal', () => {
    it('does not contain Alamat field and only asks for customer name and phone', () => {
      render(
        <QuickCreateCustomerModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      expect(screen.getByText('Tambah Customer Baru')).toBeInTheDocument();
      expect(screen.getByLabelText(/nama customer/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/no\. telepon/i)).toBeInTheDocument();

      // Alamat field MUST NOT be in the modal
      expect(screen.queryByLabelText(/alamat/i)).not.toBeInTheDocument();
    });

    it('submits successfully without address payload', async () => {
      mockCreatePartnerMutateAsync.mockResolvedValueOnce({
        id: 'new-cust-1',
        name: 'Ani Yudhoyono',
        phone: '081299990000',
      });

      render(
        <QuickCreateCustomerModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      const nameInput = screen.getByLabelText(/nama customer/i);
      const phoneInput = screen.getByLabelText(/no\. telepon/i);
      const submitBtn = screen.getByRole('button', { name: /tambah customer/i });

      fireEvent.change(nameInput, { target: { value: 'Ani Yudhoyono' } });
      fireEvent.change(phoneInput, { target: { value: '081299990000' } });
      fireEvent.click(submitBtn);

      expect(mockCreatePartnerMutateAsync).toHaveBeenCalledWith({
        name: 'Ani Yudhoyono',
        phone: '081299990000',
        type: 'CUSTOMER',
      });
    });
  });

  describe('Feedback 6: MapSelectorModal', () => {
    it('renders search input, Google Maps link extractor, and location columns', () => {
      render(
        <MapSelectorModal
          isOpen={true}
          onClose={vi.fn()}
          onSelect={vi.fn()}
          initialCoords={{ lat: -7.7956, lng: 110.3695 }}
        />
      );

      expect(
        screen.getByText('Pilih Titik Lokasi Pengantaran (Peta)')
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/contoh: hotel tentrem, malioboro/i)
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/maps\.app\.goo\.gl/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /ekstrak/i })
      ).toBeInTheDocument();

      // Check structured address column labels
      expect(
        screen.getByText('Alamat Jalan / Patokan')
      ).toBeInTheDocument();
      expect(screen.getByText('Kelurahan / Desa')).toBeInTheDocument();
      expect(screen.getByText('Kecamatan')).toBeInTheDocument();
      expect(screen.getByText('Kabupaten / Kota')).toBeInTheDocument();
      expect(screen.getByText('Provinsi')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /gunakan lokasi ini/i })
      ).toBeInTheDocument();
    });
  });
});

