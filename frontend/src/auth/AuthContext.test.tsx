import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { notifyAuthExpired } from '../lib/tokenStore';

const postMock = vi.fn();
vi.mock('../lib/api', () => ({
  api: { post: (...args: unknown[]) => postMock(...args) },
}));

function TestConsumer() {
  const { user, isLoading, login, register, logout } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="user">{user ? user.name : 'none'}</div>
      <button onClick={() => void login('alice@example.com', 'password123')}>login</button>
      <button onClick={() => void register('alice@example.com', 'password123', 'Alice')}>register</button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

const aliceUser = { id: 'user-1', email: 'alice@example.com', name: 'Alice', createdAt: new Date().toISOString() };

describe('AuthProvider', () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it('starts in a loading state before the mount-time refresh resolves', () => {
    postMock.mockReturnValue(new Promise(() => {})); // never resolves within this test
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    expect(screen.getByTestId('loading').textContent).toBe('true');
    expect(screen.getByTestId('user').textContent).toBe('none');
  });

  it('authenticates on mount when the refresh cookie is valid', async () => {
    postMock.mockResolvedValueOnce({ data: { accessToken: 'tok-1', user: aliceUser } });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('Alice'));
    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(postMock).toHaveBeenCalledWith('/auth/refresh');
  });

  it('stays unauthenticated when the mount-time refresh fails', async () => {
    postMock.mockRejectedValueOnce(new Error('no valid session'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('user').textContent).toBe('none');
  });

  it('login sets the authenticated user', async () => {
    postMock.mockRejectedValueOnce(new Error('no session')); // mount refresh
    postMock.mockResolvedValueOnce({ data: { accessToken: 'tok-2', user: aliceUser } }); // login()

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    await userEvent.click(screen.getByText('login'));

    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('Alice'));
    expect(postMock).toHaveBeenLastCalledWith('/auth/login', {
      email: 'alice@example.com',
      password: 'password123',
    });
  });

  it('register sets the authenticated user', async () => {
    postMock.mockRejectedValueOnce(new Error('no session'));
    postMock.mockResolvedValueOnce({ data: { accessToken: 'tok-3', user: aliceUser } });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    await userEvent.click(screen.getByText('register'));

    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('Alice'));
    expect(postMock).toHaveBeenLastCalledWith('/auth/register', {
      email: 'alice@example.com',
      password: 'password123',
      name: 'Alice',
    });
  });

  it('logout clears the user even if the API call fails', async () => {
    postMock.mockResolvedValueOnce({ data: { accessToken: 'tok-1', user: aliceUser } }); // mount refresh
    postMock.mockRejectedValueOnce(new Error('network error')); // logout() fails server-side

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('Alice'));

    await userEvent.click(screen.getByText('logout'));

    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('none'));
  });

  it('clears the user when the shared auth-expired handler fires (e.g. from a failed token refresh elsewhere)', async () => {
    postMock.mockResolvedValueOnce({ data: { accessToken: 'tok-1', user: aliceUser } });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('Alice'));

    notifyAuthExpired();

    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('none'));
  });

  it('useAuth throws when used outside an AuthProvider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<TestConsumer />)).toThrow('useAuth must be used within AuthProvider');

    consoleSpy.mockRestore();
  });
});
