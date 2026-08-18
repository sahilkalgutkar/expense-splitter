import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';

let authState: { user: { name: string } | null; isLoading: boolean };
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => authState,
}));

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <p>secret content</p>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<p>login page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('shows a loading state while auth is resolving, without rendering children', () => {
    authState = { user: null, isLoading: true };
    renderProtected();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', () => {
    authState = { user: null, isLoading: false };
    renderProtected();
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    authState = { user: { name: 'Alice' }, isLoading: false };
    renderProtected();
    expect(screen.getByText('secret content')).toBeInTheDocument();
  });
});
