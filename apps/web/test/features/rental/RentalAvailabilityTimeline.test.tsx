import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import {
  RentalAvailabilityTimeline,
  type RentalAvailabilityTimelineData,
} from '@/features/rental/components/RentalAvailabilityTimeline';

const timeline: RentalAvailabilityTimelineData = {
  items: [
    {
      id: 'item-1',
      name: 'Tenda Dome',
      units: [
        {
          id: 'unit-1',
          unitCode: 'TD-01',
          status: 'AVAILABLE',
          bookings: [
            {
              orderId: 'order-1',
              orderNumber: 'RO-001',
              partnerName: 'PT Pelanggan',
              startDate: new Date(2026, 7, 25),
              endDate: new Date(2026, 7, 26),
              status: 'CONFIRMED',
            },
          ],
        },
      ],
    },
  ],
};

function renderTimeline(
  data: RentalAvailabilityTimelineData = timeline
) {
  return render(
    <MemoryRouter>
      <RentalAvailabilityTimeline
        timeline={data}
        startDate={new Date(2026, 7, 24)}
        daysToShow={14}
        onCreateOrder={vi.fn()}
      />
    </MemoryRouter>
  );
}

describe('RentalAvailabilityTimeline', () => {
  it('renders a two-axis scroll viewport with sticky axes and an accessible booking link', () => {
    renderTimeline();

    const viewport = screen.getByLabelText(
      /timeline ketersediaan rental/i
    );
    const booking = screen.getByRole('link', {
      name: /RO-001, PT Pelanggan/i,
    });

    expect(viewport).toHaveClass('overflow-auto');
    expect(screen.getByText('Item / unit')).toHaveClass('sticky');
    expect(screen.getByText('TD-01').parentElement).toHaveClass(
      'sticky'
    );
    expect(booking).toHaveAttribute('href', '/rental/orders/order-1');
    expect(booking).toHaveAttribute(
      'title',
      expect.stringContaining('25 Agu 2026')
    );
  });

  it('explains when visible units have no bookings in the selected range', () => {
    renderTimeline({
      items: [
        {
          ...timeline.items[0],
          units: [{ ...timeline.items[0].units[0], bookings: [] }],
        },
      ],
    });

    expect(screen.getByRole('status')).toHaveTextContent(
      /belum ada booking pada rentang ini/i
    );
  });

  it('calls onCreateOrder with rentalItemId when clicking + button on available unit', () => {
    const onCreateOrder = vi.fn();
    render(
      <MemoryRouter>
        <RentalAvailabilityTimeline
          timeline={timeline}
          startDate={new Date(2026, 7, 24)}
          daysToShow={14}
          onCreateOrder={onCreateOrder}
        />
      </MemoryRouter>
    );

    const plusBtn = screen.getByRole('button', {
      name: /buat order untuk unit td-01/i,
    });
    plusBtn.click();
    expect(onCreateOrder).toHaveBeenCalledWith({ rentalItemId: 'item-1' });
  });
});
