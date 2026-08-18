import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./pages/LoginPage', () => ({ LoginPage: () => <div>login-page</div> }));
vi.mock('./pages/RegisterPage', () => ({ RegisterPage: () => <div>register-page</div> }));
vi.mock('./pages/GroupsDashboardPage', () => ({ GroupsDashboardPage: () => <div>groups-dashboard-page</div> }));
vi.mock('./pages/GroupDetailPage', () => ({ GroupDetailPage: () => <div>group-detail-page</div> }));
vi.mock('./pages/AcceptInvitePage', () => ({ AcceptInvitePage: () => <div>accept-invite-page</div> }));

let authUser: { id: string } | null = null;
vi.mock('./auth/AuthContext', () => ({
  useAuth: () => ({ user: authUser, isLoading: false, login: vi.fn(), register: vi.fn(), logout: vi.fn() }),
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App routing', () => {
  it('renders LoginPage at /login', () => {
    authUser = null;
    renderAt('/login');
    expect(screen.getByText('login-page')).toBeInTheDocument();
  });

  it('renders RegisterPage at /register', () => {
    authUser = null;
    renderAt('/register');
    expect(screen.getByText('register-page')).toBeInTheDocument();
  });

  it('renders AcceptInvitePage at /invite/:token without requiring auth', () => {
    authUser = null;
    renderAt('/invite/tok-123');
    expect(screen.getByText('accept-invite-page')).toBeInTheDocument();
  });

  it('redirects an unauthenticated user away from the protected root route', () => {
    authUser = null;
    renderAt('/');
    expect(screen.getByText('login-page')).toBeInTheDocument();
  });

  it('renders GroupsDashboardPage at / for an authenticated user', () => {
    authUser = { id: 'u1' };
    renderAt('/');
    expect(screen.getByText('groups-dashboard-page')).toBeInTheDocument();
  });

  it('renders GroupDetailPage at /groups/:groupId for an authenticated user', () => {
    authUser = { id: 'u1' };
    renderAt('/groups/g1');
    expect(screen.getByText('group-detail-page')).toBeInTheDocument();
  });

  it('redirects unknown paths to the root route', () => {
    authUser = { id: 'u1' };
    renderAt('/does-not-exist');
    expect(screen.getByText('groups-dashboard-page')).toBeInTheDocument();
  });
});
