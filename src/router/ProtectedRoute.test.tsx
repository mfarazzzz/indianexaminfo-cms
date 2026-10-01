/**
 * ProtectedRoute + LoginPage — the user-visible half of owner R3.
 *
 * The provider decides WHY the reader is logged out (see AuthContext.test); this
 * pins what the reader then SEES:
 *   • expired  → redirected to /login?reason=expired, and the login screen shows
 *     the plain message "Your session expired. Please sign in again."
 *   • plain    → redirected to /login with NO reason param and NO expiry banner.
 *   • loading  → the spinner (never a redirect while a guarded init is running).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({
  supabase: { auth: { resetPasswordForEmail: vi.fn(async () => ({ error: null })) } },
}));
vi.mock('@/config/env', () => ({ env: { SUPABASE_URL: 'https://real.supabase.co' } }));

import { useAuth } from '@/hooks/useAuth';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginPage } from '@/pages/auth/LoginPage';

const useAuthMock = vi.mocked(useAuth);

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
}

function harness() {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/protected" element={<div>dashboard</div>} />
        </Route>
        <Route path="/login" element={<><LocationProbe /><LoginPage /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAuthMock.mockReset();
});

describe('ProtectedRoute → LoginPage', () => {
  it('expired session lands on /login?reason=expired with the plain message', () => {
    useAuthMock.mockReturnValue({ user: null, isLoading: false, authExpired: true } as never);
    harness();
    expect(screen.getByTestId('loc').textContent).toBe('/login?reason=expired');
    expect(screen.getByRole('alert').textContent).toContain('Your session expired. Please sign in again.');
  });

  it('a clean logged-out load goes to plain /login with no expiry banner', () => {
    useAuthMock.mockReturnValue({ user: null, isLoading: false, authExpired: false } as never);
    harness();
    expect(screen.getByTestId('loc').textContent).toBe('/login');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('while the guarded init runs it shows the spinner, not a redirect', () => {
    useAuthMock.mockReturnValue({ user: null, isLoading: true, authExpired: false } as never);
    harness();
    expect(screen.queryByTestId('loc')).toBeNull();
    // Loader2 renders an <svg> carrying the passed className — `screen` itself
    // has no querySelector, so query the document for the spinner.
    expect(document.querySelector('svg.animate-spin')).toBeTruthy();
  });
});
