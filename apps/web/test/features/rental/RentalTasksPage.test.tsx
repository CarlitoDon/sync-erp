import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import RentalTasksPage from '@/features/rental/pages/RentalTasksPage';
import type { RentalAdminTaskQueueResponse } from '@sync-erp/shared';

const mockTaskQueue: RentalAdminTaskQueueResponse = {
  summary: {
    totalPendingTasks: 3,
    overdueCount: 1,
    todayCount: 1,
    upcomingCount: 1,
    byCategory: {
      confirmationCount: 1,
      deliveryCount: 1,
      pelunasanCount: 1,
      pickupCount: 0,
      returnSettlementCount: 0,
    },
  },
  tasks: [
    {
      id: 'task-1',
      orderId: '00000000-0000-0000-0000-000000000001',
      orderNumber: 'RO-1001',
      partnerId: '00000000-0000-0000-0000-000000000002',
      customerName: 'Budi Santoso',
      customerPhone: '081234567890',
      taskType: 'CONFIRM_AND_DP',
      category: 'CONFIRMATION',
      urgency: 'OVERDUE',
      title: 'Konfirmasi Pesanan & Catat DP: Budi Santoso',
      description: 'Pesanan DRAFT (1x Kasur 120x200)',
      scheduledDate: '2026-09-17T00:00:00.000Z',
      daysDiff: -2,
      orderStatus: 'DRAFT',
      paymentStatus: 'PENDING',
      totalAmount: 150000,
      depositAmount: 0,
      remainingAmount: 150000,
      deliveryAddress: 'Jl. Malioboro No. 10',
      itemsSummary: '1x Kasur 120x200',
      suggestedAction: 'CONFIRM',
    },
    {
      id: 'task-2',
      orderId: '00000000-0000-0000-0000-000000000003',
      orderNumber: 'RO-1002',
      partnerId: '00000000-0000-0000-0000-000000000004',
      customerName: 'Siti Rahma',
      customerPhone: '+628987654321',
      taskType: 'DELIVERY_DISPATCH',
      category: 'DELIVERY',
      urgency: 'TODAY',
      title: 'Kirim & Serah Terima Hari Ini: Siti Rahma',
      description: 'Kirim 2x Kasur ke Jl. Kaliurang',
      scheduledDate: '2026-09-19T00:00:00.000Z',
      daysDiff: 0,
      orderStatus: 'CONFIRMED',
      paymentStatus: 'PENDING',
      totalAmount: 300000,
      depositAmount: 100000,
      remainingAmount: 200000,
      deliveryAddress: 'Jl. Kaliurang KM 5',
      itemsSummary: '2x Kasur 120x200',
      suggestedAction: 'RELEASE',
    },
    {
      id: 'task-3',
      orderId: '00000000-0000-0000-0000-000000000005',
      orderNumber: 'RO-1003',
      partnerId: '00000000-0000-0000-0000-000000000006',
      customerName: 'Ahmad Fauzi',
      customerPhone: '-', // Invalid malformed phone number
      taskType: 'PELUNASAN_PAYMENT',
      category: 'PELUNASAN',
      urgency: 'UPCOMING',
      title: 'Tagihan Pelunasan (Rp 200.000): Ahmad Fauzi',
      description: 'Sisa pelunasan belum dibayar',
      scheduledDate: '2026-09-21T00:00:00.000Z',
      daysDiff: 2,
      orderStatus: 'CONFIRMED',
      paymentStatus: 'PENDING',
      totalAmount: 300000,
      depositAmount: 100000,
      remainingAmount: 200000,
      deliveryAddress: 'Jl. Gejayan',
      itemsSummary: '1x Kasur 160x200',
      suggestedAction: 'RECORD_PELUNASAN',
    },
  ],
};

vi.mock('@/features/rental/modals/ConfirmOrderModal', () => ({
  default: ({ isOpen, orderId }: { isOpen: boolean; orderId: string | null }) =>
    isOpen ? <div data-testid="confirm-modal">{orderId}</div> : null,
}));

vi.mock('@/features/rental/modals/UnitAssignmentModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="unit-assignment-modal" /> : null,
}));

vi.mock('@/features/rental/modals/VerifyPaymentModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="verify-payment-modal" /> : null,
}));

vi.mock('@/features/rental/modals/ReturnModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="return-modal" /> : null,
}));

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: vi.fn(() => ({
    currentCompany: { id: 'comp-1', name: 'Santi Living' },
    companies: [],
    setCurrentCompany: vi.fn(),
    refreshCompanies: vi.fn(),
    isLoading: false,
  })),
}));

const mockRefetch = vi.fn();
const mockInvalidate = vi.fn();

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: vi.fn(() => ({
      rental: {
        tasks: {
          getQueue: { invalidate: mockInvalidate },
          getSummary: { invalidate: mockInvalidate },
        },
        orders: {
          list: { invalidate: mockInvalidate },
          getById: { invalidate: mockInvalidate },
        },
      },
    })),
    rental: {
      tasks: {
        getQueue: {
          useQuery: vi.fn(() => ({
            data: mockTaskQueue,
            isLoading: false,
            refetch: mockRefetch,
          })),
        },
        getSummary: {
          useQuery: vi.fn(() => ({
            data: mockTaskQueue.summary,
            isLoading: false,
          })),
        },
      },
      orders: {
        getById: {
          useQuery: vi.fn(() => ({
            data: null,
            isLoading: false,
          })),
        },
      },
    },
  },
}));

describe('RentalTasksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders KPI metric summary cards with correct counts', () => {
    render(
      <MemoryRouter>
        <RentalTasksPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Tugas Admin Rental')).toBeInTheDocument();
    expect(screen.getByText('Total Tugas')).toBeInTheDocument();
    expect(screen.getByText('Terlambat')).toBeInTheDocument();
    expect(screen.getAllByText('Konfirmasi & DP').length).toBeGreaterThan(0);
    expect(screen.getByText('Kirim / Antar')).toBeInTheDocument();
    expect(screen.getByText('Belum Lunas')).toBeInTheDocument();
    expect(screen.getByText('Jemput Unit')).toBeInTheDocument();

    // Total tasks count = 3
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
  });

  it('renders task cards with order numbers and customer names', () => {
    render(
      <MemoryRouter>
        <RentalTasksPage />
      </MemoryRouter>
    );

    expect(screen.getByText('RO-1001')).toBeInTheDocument();
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText('RO-1002')).toBeInTheDocument();
    expect(screen.getByText('Siti Rahma')).toBeInTheDocument();
    expect(screen.getByText('RO-1003')).toBeInTheDocument();
    expect(screen.getByText('Ahmad Fauzi')).toBeInTheDocument();
  });

  it('generates valid WhatsApp click links and suppresses for invalid phone numbers', () => {
    render(
      <MemoryRouter>
        <RentalTasksPage />
      </MemoryRouter>
    );

    const chatLinks = screen.getAllByTitle('Kirim Pesan WhatsApp Langsung');
    // Task 1 (081234567890) -> 6281234567890
    // Task 2 (+628987654321) -> 628987654321
    // Task 3 ("-") -> invalid, suppressed
    expect(chatLinks.length).toBe(2);

    expect(chatLinks[0]?.getAttribute('href')).toContain('https://wa.me/6281234567890');
    expect(chatLinks[1]?.getAttribute('href')).toContain('https://wa.me/628987654321');
  });

  it('filters task cards by client search query', () => {
    render(
      <MemoryRouter>
        <RentalTasksPage />
      </MemoryRouter>
    );

    const searchInput = screen.getByPlaceholderText(
      'Cari customer, nomor order, alamat...'
    );
    fireEvent.change(searchInput, { target: { value: 'Siti' } });

    expect(screen.getByText('Siti Rahma')).toBeInTheDocument();
    expect(screen.queryByText('Budi Santoso')).not.toBeInTheDocument();
    expect(screen.queryByText('Ahmad Fauzi')).not.toBeInTheDocument();
  });

  it('renders 1-click action triggers', () => {
    render(
      <MemoryRouter>
        <RentalTasksPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Konfirmasi Order & DP')).toBeInTheDocument();
    expect(screen.getByText('Kirim & Serah Terima')).toBeInTheDocument();
    expect(screen.getByText('Detail Pelunasan Order')).toBeInTheDocument();
  });
});
