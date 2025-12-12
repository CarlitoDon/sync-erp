import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FinancialReport, ReportSection } from '../../src/components/FinancialReport';

const mockSections: ReportSection[] = [
  {
    title: 'Assets',
    groups: [
      {
        type: 'ASSET',
        total: 50000,
        accounts: [
          { id: '1', code: '1100', name: 'Cash', balance: 30000 },
          { id: '2', code: '1200', name: 'Accounts Receivable', balance: 20000 },
        ],
      },
    ],
    totalLabel: 'Total Assets',
    totalValue: 50000,
  },
  {
    title: 'Liabilities',
    groups: [
      {
        type: 'LIABILITY',
        total: 20000,
        accounts: [{ id: '3', code: '2100', name: 'Accounts Payable', balance: 20000 }],
      },
    ],
    totalLabel: 'Total Liabilities',
    totalValue: 20000,
  },
];

describe('FinancialReport', () => {
  describe('Basic Rendering', () => {
    it('renders title', () => {
      render(<FinancialReport title="Balance Sheet" sections={mockSections} />);

      expect(screen.getByText('Balance Sheet')).toBeInTheDocument();
    });

    it('renders subtitle when provided', () => {
      render(
        <FinancialReport
          title="Balance Sheet"
          subtitle="As of December 2024"
          sections={mockSections}
        />
      );

      expect(screen.getByText('As of December 2024')).toBeInTheDocument();
    });

    it('does not render subtitle when not provided', () => {
      render(<FinancialReport title="Balance Sheet" sections={mockSections} />);

      expect(screen.queryByText('As of')).not.toBeInTheDocument();
    });
  });

  describe('Sections', () => {
    it('renders section titles', () => {
      render(<FinancialReport title="Report" sections={mockSections} />);

      expect(screen.getByText('Assets')).toBeInTheDocument();
      expect(screen.getByText('Liabilities')).toBeInTheDocument();
    });

    it('renders section total labels', () => {
      render(<FinancialReport title="Report" sections={mockSections} />);

      expect(screen.getByText('Total Assets')).toBeInTheDocument();
      expect(screen.getByText('Total Liabilities')).toBeInTheDocument();
    });

    it('renders account codes', () => {
      render(<FinancialReport title="Report" sections={mockSections} />);

      expect(screen.getByText('1100')).toBeInTheDocument();
      expect(screen.getByText('1200')).toBeInTheDocument();
      expect(screen.getByText('2100')).toBeInTheDocument();
    });

    it('renders account names', () => {
      render(<FinancialReport title="Report" sections={mockSections} />);

      expect(screen.getByText('Cash')).toBeInTheDocument();
      expect(screen.getByText('Accounts Receivable')).toBeInTheDocument();
      expect(screen.getByText('Accounts Payable')).toBeInTheDocument();
    });

    it('renders group totals', () => {
      render(<FinancialReport title="Report" sections={mockSections} />);

      expect(screen.getByText('Total ASSET')).toBeInTheDocument();
      expect(screen.getByText('Total LIABILITY')).toBeInTheDocument();
    });
  });

  describe('Grand Total', () => {
    it('renders grand total when provided', () => {
      render(
        <FinancialReport
          title="Report"
          sections={mockSections}
          grandTotalLabel="Net Worth"
          grandTotalValue={30000}
        />
      );

      expect(screen.getByText('Net Worth')).toBeInTheDocument();
    });

    it('does not render grand total when not provided', () => {
      render(<FinancialReport title="Report" sections={mockSections} />);

      expect(screen.queryByText('Net Worth')).not.toBeInTheDocument();
    });
  });

  describe('Balance Status', () => {
    it('shows "Balanced" badge when isBalanced is true', () => {
      render(<FinancialReport title="Report" sections={mockSections} isBalanced={true} />);

      expect(screen.getByText('Balanced')).toBeInTheDocument();
    });

    it('shows "Unbalanced" badge when isBalanced is false', () => {
      render(<FinancialReport title="Report" sections={mockSections} isBalanced={false} />);

      expect(screen.getByText('Unbalanced')).toBeInTheDocument();
    });

    it('shows green styling for balanced', () => {
      render(<FinancialReport title="Report" sections={mockSections} isBalanced={true} />);

      const badge = screen.getByText('Balanced');
      expect(badge).toHaveClass('bg-green-100');
      expect(badge).toHaveClass('text-green-800');
    });

    it('shows red styling for unbalanced', () => {
      render(<FinancialReport title="Report" sections={mockSections} isBalanced={false} />);

      const badge = screen.getByText('Unbalanced');
      expect(badge).toHaveClass('bg-red-100');
      expect(badge).toHaveClass('text-red-800');
    });

    it('does not show balance badge when isBalanced is undefined', () => {
      render(<FinancialReport title="Report" sections={mockSections} />);

      expect(screen.queryByText('Balanced')).not.toBeInTheDocument();
      expect(screen.queryByText('Unbalanced')).not.toBeInTheDocument();
    });
  });

  describe('Empty Groups', () => {
    it('handles sections with empty account groups', () => {
      const emptySections: ReportSection[] = [
        {
          title: 'Empty Section',
          groups: [
            {
              type: 'ASSET',
              total: 0,
              accounts: [],
            },
          ],
          totalLabel: 'Section Total',
          totalValue: 0,
        },
      ];

      render(<FinancialReport title="Report" sections={emptySections} />);

      expect(screen.getByText('Empty Section')).toBeInTheDocument();
      expect(screen.getByText('Section Total')).toBeInTheDocument();
    });
  });
});
