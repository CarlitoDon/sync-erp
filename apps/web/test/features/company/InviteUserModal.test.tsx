import { render, screen } from '@testing-library/react';
import { InviteUserModal } from '@/features/company/components/InviteUserModal';
import * as CompanyContext from '@/contexts/CompanyContext';
import { BusinessShape, type Company } from '@/types/api';

vi.mock('@/contexts/CompanyContext', async () => {
  const actual = await vi.importActual('@/contexts/CompanyContext');
  return {
    ...actual,
    useCompany: vi.fn(),
  };
});

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
  },
}));

describe('InviteUserModal', () => {
  const company: Company = {
    id: 'company-1',
    name: 'Acme Rentals',
    createdAt: new Date(),
    updatedAt: new Date(),
    businessShape: BusinessShape.RENTAL,
    onboardingStatus: 'ACTIVE' as any,
    onboardingStep: 'DONE' as any,
    onboardingCompletedAt: null as any,
    onboardingMeta: {} as any,
    inviteCode: 'INVITE-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(CompanyContext.useCompany).mockReturnValue({
      currentCompany: company,
      companies: [company],
      setCurrentCompany: vi.fn(),
      refreshCompanies: vi.fn(),
      isLoading: false,
    });
  });

  it('shows a copyable invite code and invite link', () => {
    render(<InviteUserModal isOpen onClose={vi.fn()} />);

    expect(screen.getByText('Invite Code')).toBeInTheDocument();
    expect(screen.getByLabelText('Invite Code')).toHaveValue(
      'INVITE-123'
    );
    expect(
      screen.getByRole('button', { name: /copy invite code/i })
    ).toBeInTheDocument();

    expect(screen.getByText('Invite Link')).toBeInTheDocument();
    expect(screen.getByLabelText('Invite Link')).toHaveValue(
      'http://localhost:3000/select-company?inviteCode=INVITE-123'
    );
    expect(
      screen.getByRole('button', { name: /copy invite link/i })
    ).toBeInTheDocument();
  });

  it('does not render credential creation fields', () => {
    render(<InviteUserModal isOpen onClose={vi.fn()} />);

    expect(screen.queryByLabelText(/^email$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^name$/i)).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/password/i)
    ).not.toBeInTheDocument();
  });

  it('warns when the company has no invite code', () => {
    vi.mocked(CompanyContext.useCompany).mockReturnValue({
      currentCompany: { ...company, inviteCode: '' },
      companies: [{ ...company, inviteCode: '' }],
      setCurrentCompany: vi.fn(),
      refreshCompanies: vi.fn(),
      isLoading: false,
    });

    render(<InviteUserModal isOpen onClose={vi.fn()} />);

    expect(
      screen.getByText(/does not have an invite code/i)
    ).toBeInTheDocument();
  });
});
