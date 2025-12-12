import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../../src/pages/LoginPage';
import * as AuthContext from '../../src/contexts/AuthContext';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../src/contexts/AuthContext', async () => {
  const actual = await vi.importActual(
    '../../src/contexts/AuthContext'
  );
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

describe('LoginPage', () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      login: mockLogin,
      register: vi.fn(),
      logout: vi.fn(),
      checkAuth: vi.fn(),
    });
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );
  };

  // Helper to get inputs by name attribute since labels don't have htmlFor
  const getInputByName = (name: string): HTMLInputElement => {
    return document.querySelector(
      `input[name="${name}"]`
    ) as HTMLInputElement;
  };

  describe('Rendering', () => {
    it('renders sign in heading', () => {
      renderComponent();
      expect(
        screen.getByRole('heading', { name: /sign in/i })
      ).toBeInTheDocument();
    });

    it('renders email input', () => {
      renderComponent();
      expect(getInputByName('email')).toBeInTheDocument();
    });

    it('renders password input', () => {
      renderComponent();
      expect(getInputByName('password')).toBeInTheDocument();
    });

    it('renders sign in button', () => {
      renderComponent();
      expect(
        screen.getByRole('button', { name: /sign in/i })
      ).toBeInTheDocument();
    });

    it('renders sign up link', () => {
      renderComponent();
      expect(
        screen.getByRole('link', { name: /sign up/i })
      ).toBeInTheDocument();
    });
  });

  describe('Form Interaction', () => {
    it('allows typing in email field', () => {
      renderComponent();
      const emailInput = getInputByName('email');
      fireEvent.change(emailInput, {
        target: { value: 'test@example.com' },
      });
      expect(emailInput).toHaveValue('test@example.com');
    });

    it('allows typing in password field', () => {
      renderComponent();
      const passwordInput = getInputByName('password');
      fireEvent.change(passwordInput, {
        target: { value: 'password123' },
      });
      expect(passwordInput).toHaveValue('password123');
    });
  });

  describe('Form Submission', () => {
    it('calls login with form data on submit', async () => {
      mockLogin.mockResolvedValueOnce({});
      renderComponent();

      fireEvent.change(getInputByName('email'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(getInputByName('password'), {
        target: { value: 'password123' },
      });
      fireEvent.click(
        screen.getByRole('button', { name: /sign in/i })
      );

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });

    it('navigates to /select-company on successful login', async () => {
      mockLogin.mockResolvedValueOnce({});
      renderComponent();

      fireEvent.change(getInputByName('email'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(getInputByName('password'), {
        target: { value: 'password123' },
      });
      fireEvent.click(
        screen.getByRole('button', { name: /sign in/i })
      );

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/select-company');
      });
    });

    it('shows loading state during submission', async () => {
      mockLogin.mockImplementation(() => new Promise(() => {}));
      renderComponent();

      fireEvent.change(getInputByName('email'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(getInputByName('password'), {
        target: { value: 'password123' },
      });
      fireEvent.click(
        screen.getByRole('button', { name: /sign in/i })
      );

      await waitFor(() => {
        expect(screen.getByText(/please wait/i)).toBeInTheDocument();
      });
    });

    it('shows error message on login failure', async () => {
      mockLogin.mockRejectedValueOnce({
        response: {
          data: { error: { message: 'Invalid credentials' } },
        },
      });
      renderComponent();

      fireEvent.change(getInputByName('email'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(getInputByName('password'), {
        target: { value: 'wrongpassword' },
      });
      fireEvent.click(
        screen.getByRole('button', { name: /sign in/i })
      );

      await waitFor(() => {
        expect(
          screen.getByText(/invalid credentials/i)
        ).toBeInTheDocument();
      });
    });
  });
});
