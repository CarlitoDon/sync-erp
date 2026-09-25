import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  RentalLogisticsCard,
  type RentalLogisticsOrder,
} from '@/features/rental/components/RentalLogisticsCard';

function createMockOrder(
  overrides: Partial<RentalLogisticsOrder> = {}
): RentalLogisticsOrder {
  return {
    deliveryAddress: 'Jl. Kaliurang KM 5, Gang Pandega Marta No. 12',
    notes: 'Keterangan pengantaran pagi',
    latitude: null,
    longitude: null,
    partner: {
      name: 'Budi Santoso',
      phone: '081234567890',
      address: 'Jl. Kaliurang KM 5',
    },
    ...overrides,
  };
}

describe('RentalLogisticsCard', () => {
  it('renders delivery address and recipient contact information', () => {
    const order = createMockOrder({
      deliveryAddress: 'Jl. Kaliurang KM 5 No. 10',
    });

    render(<RentalLogisticsCard order={order} />);

    expect(screen.getByText('Pengiriman & Logistik')).toBeInTheDocument();
    expect(screen.getByText(/Jl\. Kaliurang KM 5 No\. 10/)).toBeInTheDocument();
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText('081234567890')).toBeInTheDocument();
  });

  it('renders Google Maps link button when URL is in notes or address', () => {
    const order = createMockOrder({
      deliveryAddress: 'Jl. Kaliurang KM 5\nMaps: https://maps.app.goo.gl/abcdef123',
    });

    render(<RentalLogisticsCard order={order} />);

    const mapsBtn = screen.getByRole('link', { name: /buka di google maps/i });
    expect(mapsBtn).toBeInTheDocument();
    expect(mapsBtn).toHaveAttribute('href', 'https://maps.app.goo.gl/abcdef123');
    expect(mapsBtn).toHaveAttribute('target', '_blank');
    // Ensure the raw maps url is stripped from the address text
    expect(screen.getByText('Jl. Kaliurang KM 5')).toBeInTheDocument();
  });

  it('renders WhatsApp link with formatted phone number', () => {
    const order = createMockOrder();

    render(<RentalLogisticsCard order={order} />);

    const waBtn = screen.getByRole('link', { name: /hubungi via whatsapp/i });
    expect(waBtn).toBeInTheDocument();
    expect(waBtn).toHaveAttribute('href', 'https://wa.me/6281234567890');
    expect(waBtn).toHaveAttribute('target', '_blank');
  });

  it('extracts and displays badges for mattress handling (stairs & fitted sheet)', () => {
    const order = createMockOrder({
      notes: 'Kasur naik lantai atas: 2 unit\nPasang sprei: 1 unit\nTolong telpon sebelum sampai',
    });

    render(<RentalLogisticsCard order={order} />);

    expect(screen.getByText('Naik Lantai: 2 unit')).toBeInTheDocument();
    expect(screen.getByText('Pasang Sprei: 1 unit')).toBeInTheDocument();
    expect(screen.getByText(/tolong telpon sebelum sampai/i)).toBeInTheDocument();
  });

  it('formats floor numbers cleanly as Lantai X', () => {
    const order = createMockOrder({
      notes: 'Lantai 3, kamar pojok kanan',
    });

    render(<RentalLogisticsCard order={order} />);

    expect(screen.getByText('Lantai 3')).toBeInTheDocument();
  });

  it('does NOT display false-positive badges for negative fitted sheet or 0 unit upstairs', () => {
    const order = createMockOrder({
      notes: 'Pasang sprei: Tidak\nKasur naik lantai atas: 0 unit\nCatatan kurir aman',
    });

    render(<RentalLogisticsCard order={order} />);

    expect(screen.queryByText(/pasang sprei/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/naik lantai/i)).not.toBeInTheDocument();
    expect(screen.getByText('Catatan kurir aman')).toBeInTheDocument();
  });

  it('filters out deposit notes from courier operational notes section', () => {
    const order = createMockOrder({
      notes: 'Deposit / Uang Jaminan: Rp 100.000\nAntar sebelum maghrib',
    });

    render(<RentalLogisticsCard order={order} />);

    expect(screen.getByText('Antar sebelum maghrib')).toBeInTheDocument();
    expect(screen.queryByText(/Deposit \/ Uang Jaminan/i)).not.toBeInTheDocument();
  });
});
