import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PaymentTermsBadge } from '@/components/ui/PaymentTermsBadge';
import { PaymentStatusBadge } from '@/components/ui/PaymentStatusBadge';
import { UpfrontPaymentCard } from '@/features/procurement/components/UpfrontPaymentCard';

describe('Cash Upfront Payment Components', () => {
  describe('PaymentTermsBadge', () => {
    it('renders UPFRONT terms with distinct styling', () => {
      render(<PaymentTermsBadge terms="UPFRONT" />);
      const badge = screen.getByText('Cash Upfront');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-red-500');
      expect(badge).toHaveClass('text-white');
    });

    it('renders standard terms (NET_30) correctly', () => {
      render(<PaymentTermsBadge terms="NET_30" />);
      const badge = screen.getByText('Net 30');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-gray-100');
    });
  });

  describe('PaymentStatusBadge', () => {
    it('renders PAID_UPFRONT status correctly', () => {
      render(<PaymentStatusBadge status="PAID_UPFRONT" />);
      const badge = screen.getByText('Paid (Upfront)');
      expect(badge).toBeInTheDocument();
    });

    it('renders PARTIAL status correctly', () => {
      render(<PaymentStatusBadge status="PARTIAL" />);
      const badge = screen.getByText('Partially Paid');
      expect(badge).toBeInTheDocument();
    });

    it('renders SETTLED status correctly', () => {
      render(<PaymentStatusBadge status="SETTLED" />);
      const badge = screen.getByText('Settled');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('UpfrontPaymentCard', () => {
    const mockProps = {
      totalAmount: 1000000,
      paidAmount: 500000,
      remainingAmount: 500000,
      paymentStatus: 'PARTIAL' as const,
      onRegisterPayment: () => {},
      canRegisterPayment: true,
    };

    it('renders total amount and paid amount correctly', () => {
      render(<UpfrontPaymentCard {...mockProps} />);

      expect(screen.getByText('Upfront Payment')).toBeInTheDocument();
      expect(screen.getByText(/50% paid/)).toBeInTheDocument();
    });

    it('shows Register Payment button when not fully paid', () => {
      render(<UpfrontPaymentCard {...mockProps} />);
      expect(
        screen.getByRole('button', { name: /register payment/i })
      ).toBeInTheDocument();
    });

    it('does NOT show Register Payment button when settled', () => {
      const settledProps = {
        ...mockProps,
        paidAmount: 1000000,
        remainingAmount: 0,
        paymentStatus: 'SETTLED' as const,
      };
      render(<UpfrontPaymentCard {...settledProps} />);
      expect(
        screen.queryByRole('button', { name: /register payment/i })
      ).not.toBeInTheDocument();
      expect(screen.getByText('Fully Paid')).toBeInTheDocument();
    });
  });
});
