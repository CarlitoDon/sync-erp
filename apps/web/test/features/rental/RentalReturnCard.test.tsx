import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  RentalReturnCard,
  type RentalReturnForView,
} from '@/features/rental/components/RentalReturnCard';
import { ReturnStatus } from '@sync-erp/shared';

describe('RentalReturnCard', () => {
  it('renders null when returnRecord is undefined or null', () => {
    const { container: container1 } = render(<RentalReturnCard />);
    expect(container1.firstChild).toBeNull();

    const { container: container2 } = render(
      <RentalReturnCard returnRecord={null} />
    );
    expect(container2.firstChild).toBeNull();
  });

  it('renders JSON notes with damagePaid cleanly and does NOT display raw JSON', () => {
    const returnRecord: RentalReturnForView = {
      id: 'ret-1',
      returnedAt: '2026-03-25T10:00:00.000Z',
      settlementStatus: ReturnStatus.SETTLED,
      settledAt: '2026-03-25T11:00:00.000Z',
      damageCharges: 100000,
      totalCharges: 100000,
      depositDeduction: 25000,
      additionalChargesDue: 0,
      notes: JSON.stringify({ damagePaid: 75000 }),
    };

    render(<RentalReturnCard returnRecord={returnRecord} />);

    // Header & Status
    expect(screen.getByText('Pengembalian & Settlement')).toBeInTheDocument();
    expect(screen.getByText(/LUNAS \(SETTLED\)/i)).toBeInTheDocument();

    // Damage Paid Badge
    expect(
      screen.getByText('Denda Kerusakan Dibayar Tunai/Transfer:')
    ).toBeInTheDocument();
    expect(screen.getByText(/75\.000/)).toBeInTheDocument();

    // Must NOT contain raw JSON string anywhere
    expect(screen.queryByText(/\{"damagePaid"/)).not.toBeInTheDocument();
  });

  it('renders plain text notes cleanly', () => {
    const returnRecord: RentalReturnForView = {
      id: 'ret-2',
      returnedAt: '2026-03-25T10:00:00.000Z',
      settlementStatus: ReturnStatus.DRAFT,
      damageCharges: 50000,
      totalCharges: 50000,
      additionalChargesDue: 50000,
      notes: 'Unit kasur terdapat noda kopi pada bagian samping.',
    };

    render(<RentalReturnCard returnRecord={returnRecord} />);

    expect(screen.getByText(/DRAFT \/ BELUM LUNAS/i)).toBeInTheDocument();
    expect(
      screen.getByText('Unit kasur terdapat noda kopi pada bagian samping.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Denda Kerusakan Dibayar Tunai/Transfer:')
    ).not.toBeInTheDocument();
  });

  it('renders JSON notes containing both damagePaid and text message without raw JSON', () => {
    const returnRecord: RentalReturnForView = {
      id: 'ret-3',
      returnedAt: '2026-03-25T10:00:00.000Z',
      settlementStatus: ReturnStatus.SETTLED,
      notes: JSON.stringify({
        damagePaid: 50000,
        notes: 'Pelanggan transfer via BCA di tempat.',
      }),
    };

    render(<RentalReturnCard returnRecord={returnRecord} />);

    expect(
      screen.getByText('Denda Kerusakan Dibayar Tunai/Transfer:')
    ).toBeInTheDocument();
    expect(screen.getByText(/50\.000/)).toBeInTheDocument();
    expect(
      screen.getByText('Pelanggan transfer via BCA di tempat.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/\{"damagePaid"/)).not.toBeInTheDocument();
  });
});
