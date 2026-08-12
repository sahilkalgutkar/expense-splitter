import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';

const loginMock = vi.fn();
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ login: loginMock, register: vi.fn(), logout: vi.fn(), user: null, isLoading: false }),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    loginMock.mockReset();
    navigateMock.mockReset();
  });

  it('renders the email/password fields and a link to register', () => {
    renderPage();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/register');
  });

  it('shows a validation error for an invalid email and does not call login', async () => {
    renderPage();

    // No TLD: passes the browser's native <input type="email"> constraint validation (so the
    // submit event actually reaches React) but fails Zod's stricter email pattern.
    await userEvent.type(screen.getByLabelText('Email'), 'alice@test');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('shows a validation error when the password is empty', async () => {
    renderPage();

    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Password is required')).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('logs in and navigates home on valid credentials', async () => {
    loginMock.mockResolvedValueOnce(undefined);
    renderPage();

    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(loginMock).toHaveBeenCalledWith('alice@example.com', 'password123'));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/'));
  });

  it('shows the server error message from a failed login and does not navigate', async () => {
    loginMock.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { message: 'Invalid credentials' } },
    });
    renderPage();

    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('falls back to a generic message for a non-axios failure', async () => {
    loginMock.mockRejectedValueOnce(new Error('network down'));
    renderPage();

    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Login failed')).toBeInTheDocument();
  });
});
