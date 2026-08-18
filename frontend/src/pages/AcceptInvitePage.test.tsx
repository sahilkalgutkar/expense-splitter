import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AcceptInvitePage } from './AcceptInvitePage';

let authState: { user: { id: string } | null; isLoading: boolean };
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => authState,
}));

const mutateMock = vi.fn();
vi.mock('../api/invites', () => ({
  useAcceptInvite: () => ({ mutate: mutateMock, isPending: false }),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

function renderPage(token = 'tok-123') {
  return render(
    <MemoryRouter initialEntries={[`/invites/${token}`]}>
      <Routes>
        <Route path="/invites/:token" element={<AcceptInvitePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AcceptInvitePage', () => {
  beforeEach(() => {
    mutateMock.mockReset();
    navigateMock.mockReset();
  });

  it('shows a loading state while auth is resolving', () => {
    authState = { user: null, isLoading: true };
    renderPage();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('prompts to log in or sign up when there is no authenticated user', () => {
    authState = { user: null, isLoading: false };
    renderPage();
    expect(screen.getByText('Log in or create an account to accept this invite.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute('href', '/register');
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it('calls acceptInvite.mutate with the token once the user is authenticated', () => {
    authState = { user: { id: 'u1' }, isLoading: false };
    renderPage('tok-123');
    expect(mutateMock).toHaveBeenCalledWith('tok-123', expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }));
    expect(screen.getByText('Joining group…')).toBeInTheDocument();
  });

  it('navigates to the new group on success', () => {
    authState = { user: { id: 'u1' }, isLoading: false };
    renderPage('tok-123');

    const { onSuccess } = mutateMock.mock.calls[0][1];
    act(() => onSuccess({ id: 'g1' }));

    expect(navigateMock).toHaveBeenCalledWith('/groups/g1');
  });

  it('shows the server error message when accepting the invite fails', () => {
    authState = { user: { id: 'u1' }, isLoading: false };
    renderPage('tok-123');

    const { onError } = mutateMock.mock.calls[0][1];
    act(() => onError({ isAxiosError: true, response: { data: { message: 'Invite expired' } } }));

    expect(screen.getByText('Invite expired')).toBeInTheDocument();
  });

  it('falls back to a generic error message for a non-axios failure', () => {
    authState = { user: { id: 'u1' }, isLoading: false };
    renderPage('tok-123');

    const { onError } = mutateMock.mock.calls[0][1];
    act(() => onError(new Error('boom')));

    expect(screen.getByText('Could not accept invite')).toBeInTheDocument();
  });
});
