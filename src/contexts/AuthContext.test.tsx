/**
 * AuthContext.test.tsx — the CMS session-init deadlock (owner R3).
 *
 * Pins the three required behaviours of the guarded session INIT:
 *   1. expired session + no usable refresh token → NOT a spinner: the user is
 *      cleared, authExpired flips true, loading stops (ProtectedRoute then sends
 *      the reader to /login with the plain message).
 *   2. a valid refresh token (getSession returns a live, server-validated
 *      session) → the user hydrates SILENTLY: no sign-out, no expiry flag.
 *   3. a hung getSession() (the deadlock itself) → the 8s timeout wins, the same
 *      expired handling runs, and the spinner ALWAYS stops.
 * Plus the clean "never signed in" case: no stored session → authExpired stays
 * FALSE, so the login screen shows no expiry warning.
 *
 * The real Supabase client and the permission guard are mocked; the profile is
 * served by a chainable db stub. No network, no auth schema.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';

// permission guard: a no-op sink the provider calls to keep the non-React layer in sync
vi.mock('@/lib/auth/permissionGuard', () => ({ setCurrentPermissions: vi.fn() }));

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(async () => {}),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
}));
vi.mock('@/lib/supabase/client', () => ({
  supabase: { auth },
  db: {
    from: (table: string) => ({
      select: () => ({
        eq: () => {
          const res =
            table === 'user_profiles'
              ? { data: activeProfile, error: null }
              : { data: [], error: null };
          const p: any = Promise.resolve(res);
          p.single = () => Promise.resolve(res);
          return p;
        },
      }),
    }),
  },
}));

import { AuthProvider, useAuth } from '@/contexts/AuthContext';

const activeProfile = {
  id: 'u1', name: 'Faraz', avatar: null, role_id: null, is_active: true,
  must_change_password: false, last_login: null, created_at: '2026-01-01',
  roles: { id: 'r1', slug: 'editor', name: 'Editor' },
};

/** Publishes the live context value so assertions can read it after effects run. */
function Probe() {
  const { user, isLoading, authExpired } = useAuth();
  return (
    <div
      data-testid="probe"
      data-loading={String(isLoading)}
      data-user={user ? user.id : 'null'}
      data-expired={String(authExpired)}
    />
  );
}

beforeEach(() => {
  auth.signOut.mockClear();
  auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AuthProvider — guarded session init', () => {
  it('silent refresh: a live, server-validated session hydrates the user with no expiry flag', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null });
    auth.getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'f@x.in' } }, error: null });

    render(<AuthProvider><Probe /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('probe').dataset.loading).toBe('false'));
    expect(screen.getByTestId('probe').dataset.user).toBe('u1');
    expect(screen.getByTestId('probe').dataset.expired).toBe('false');
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('expired + no usable refresh token: user cleared, authExpired true, spinner stops', async () => {
    // getSession replays the stale session, but the server rejects the token
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null });
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid claim: missing sub claim' } });
    localStorage.setItem('sb-x-auth-token', JSON.stringify({ session: { user: { id: 'u1' } } }));

    render(<AuthProvider><Probe /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('probe').dataset.loading).toBe('false'));
    expect(screen.getByTestId('probe').dataset.user).toBe('null');
    expect(screen.getByTestId('probe').dataset.expired).toBe('true');
    expect(auth.signOut).toHaveBeenCalled();
  });

  it('a hung getSession() (the deadlock) is broken by the 8s timeout, and the spinner ALWAYS stops', async () => {
    vi.useFakeTimers();
    // getSession never settles — exactly the deadlock that used to spin forever
    auth.getSession.mockReturnValue(new Promise(() => {}));
    localStorage.setItem('sb-x-auth-token', JSON.stringify({ session: { user: { id: 'u1' } } }));

    render(<AuthProvider><Probe /></AuthProvider>);

    // still spinning before the guard fires
    expect(screen.getByTestId('probe').dataset.loading).toBe('true');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000 + 100);
    });

    const probe = screen.getByTestId('probe');
    expect(probe.dataset.loading).toBe('false');   // never an endless spinner
    expect(probe.dataset.user).toBe('null');
    expect(probe.dataset.expired).toBe('true');     // a stored session died → expiry
    expect(auth.signOut).toHaveBeenCalled();
  });

  it('never signed in (no stored session, empty getSession): plain login, no expiry warning', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    render(<AuthProvider><Probe /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('probe').dataset.loading).toBe('false'));
    expect(screen.getByTestId('probe').dataset.user).toBe('null');
    expect(screen.getByTestId('probe').dataset.expired).toBe('false');
  });
});
