import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Layout } from './Layout';

const logoutMock = vi.fn();
let currentUser: { name: string; email: string } | null = null;
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: currentUser, logout: logoutMock, login: vi.fn(), register: vi.fn(), isLoading: false }),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

function renderLayout() {
  return render(
    <MemoryRouter>
      <Layout>
        <p>page body</p>
      </Layout>
    </MemoryRouter>,
  );
}

describe('Layout', () => {
  beforeEach(() => {
    logoutMock.mockReset();
    navigateMock.mockReset();
    currentUser = null;
  });

  it('always renders the brand link and the page content', () => {
    renderLayout();
    expect(screen.getByRole('link', { name: 'SplitEasy' })).toHaveAttribute('href', '/');
    expect(screen.getByText('page body')).toBeInTheDocument();
  });

  it('does not render the user menu when logged out', () => {
    renderLayout();
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument();
  });

  it("shows the user's name and a log out button when logged in", () => {
    currentUser = { name: 'Alice', email: 'alice@example.com' };
    renderLayout();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('logs out and navigates to /login when Log out is clicked', async () => {
    currentUser = { name: 'Alice', email: 'alice@example.com' };
    logoutMock.mockResolvedValueOnce(undefined);
    renderLayout();

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith('/login');
  });
});
