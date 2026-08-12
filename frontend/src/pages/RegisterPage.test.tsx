import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterPage } from './RegisterPage';

const registerMock = vi.fn();
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ login: vi.fn(), register: registerMock, logout: vi.fn(), user: null, isLoading: false }),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  );
}

describe('RegisterPage', () => {
  beforeEach(() => {
    registerMock.mockReset();
    navigateMock.mockReset();
  });

  it('renders name/email/password fields and a link to login', () => {
    renderPage();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  });

  it('requires a name', async () => {
    renderPage();

    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('rejects a password shorter than 8 characters', async () => {
    renderPage();

    await userEvent.type(screen.getByLabelText('Name'), 'Alice');
    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('registers and navigates home on valid input', async () => {
    registerMock.mockResolvedValueOnce(undefined);
    renderPage();

    await userEvent.type(screen.getByLabelText('Name'), 'Alice');
    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    await waitFor(() =>
      expect(registerMock).toHaveBeenCalledWith('alice@example.com', 'password123', 'Alice'),
    );
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/'));
  });

  it('shows the server error message when registration fails (e.g. duplicate email)', async () => {
    registerMock.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { message: 'Email is already registered' } },
    });
    renderPage();

    await userEvent.type(screen.getByLabelText('Name'), 'Alice');
    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));

    expect(await screen.findByText('Email is already registered')).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
