import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RegisterPage } from '@/features/auth/components/RegisterPage';
import * as AuthContext from '@/contexts/AuthContext';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/contexts/AuthContext', async () => {
  const actual = await vi.importActual('@/contexts/AuthContext');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

describe('RegisterPage', () => {
  const mockRegister = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      login: vi.fn(),
      register: mockRegister,
      logout: vi.fn(),
      checkAuth: vi.fn(),
    });
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );
  };

  // Helper to get inputs by type since labels don't have htmlFor
  const getInputByName = (name: string): HTMLInputElement => {
    return document.querySelector(
      `input[name="${name}"]`
    ) as HTMLInputElement;
  };

  describe('Rendering', () => {
    it('renders create account heading', () => {
      renderComponent();
      expect(
        screen.getByRole('heading', { name: /create account/i })
      ).toBeInTheDocument();
    });

    it('renders name input', () => {
      renderComponent();
      expect(getInputByName('name')).toBeInTheDocument();
    });

    it('renders email input', () => {
      renderComponent();
      expect(getInputByName('email')).toBeInTheDocument();
    });

    it('renders password input', () => {
      renderComponent();
      expect(getInputByName('password')).toBeInTheDocument();
    });

    it('renders sign up button', () => {
      renderComponent();
      expect(
        screen.getByRole('button', { name: /sign up/i })
      ).toBeInTheDocument();
    });

    it('renders login link', () => {
      renderComponent();
      expect(
        screen.getByRole('link', { name: /log in/i })
      ).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('calls register with form data on submit', async () => {
      mockRegister.mockResolvedValueOnce({});
      renderComponent();

      fireEvent.change(getInputByName('name'), {
        target: { value: 'Test User' },
      });
      fireEvent.change(getInputByName('email'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(getInputByName('password'), {
        target: { value: 'password123' },
      });
      fireEvent.click(
        screen.getByRole('button', { name: /sign up/i })
      );

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });

    it('navigates to / on successful registration', async () => {
      mockRegister.mockResolvedValueOnce({});
      renderComponent();

      fireEvent.change(getInputByName('name'), {
        target: { value: 'Test User' },
      });
      fireEvent.change(getInputByName('email'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(getInputByName('password'), {
        target: { value: 'password123' },
      });
      fireEvent.click(
        screen.getByRole('button', { name: /sign up/i })
      );

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    it('shows loading state during submission', async () => {
      mockRegister.mockImplementation(() => new Promise(() => {}));
      renderComponent();

      fireEvent.change(getInputByName('name'), {
        target: { value: 'Test User' },
      });
      fireEvent.change(getInputByName('email'), {
        target: { value: 'test@example.com' },
      });
      fireEvent.change(getInputByName('password'), {
        target: { value: 'password123' },
      });
      fireEvent.click(
        screen.getByRole('button', { name: /sign up/i })
      );

      await waitFor(() => {
        expect(
          screen.getByText(/creating account/i)
        ).toBeInTheDocument();
      });
    });

    it('shows error message on registration failure', async () => {
      mockRegister.mockRejectedValueOnce({
        response: {
          data: { error: { message: 'Email already exists' } },
        },
      });
      renderComponent();

      fireEvent.change(getInputByName('name'), {
        target: { value: 'Test User' },
      });
      fireEvent.change(getInputByName('email'), {
        target: { value: 'existing@example.com' },
      });
      fireEvent.change(getInputByName('password'), {
        target: { value: 'password123' },
      });
      fireEvent.click(
        screen.getByRole('button', { name: /sign up/i })
      );

      await waitFor(() => {
        expect(
          screen.getByText(/email already exists/i)
        ).toBeInTheDocument();
      });
    });
  });
});
