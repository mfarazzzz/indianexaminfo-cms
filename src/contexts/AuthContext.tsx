import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { supabase } from "@/lib/supabase/client";
import { db } from "@/lib/supabase/client";
import { setCurrentPermissions } from "@/lib/auth/permissionGuard";
import type { AuthUser, UserProfile } from "@/types/user";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  permissions: string[];
  /** True when a session was present on this device but could NOT be resumed
   *  (expired with no usable refresh token, or the init call hung). ProtectedRoute
   *  turns this into a redirect to /login?reason=expired. A clean "never signed
   *  in" load leaves it false so the login screen shows no expiry warning. */
  authExpired: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Bound on the session-init await. Supabase's getSession() can hang when the
// stored access token is expired and the refresh token is unusable — without
// this the ProtectedRoute spinner never stops (the standing auth deadlock).
const SESSION_INIT_TIMEOUT_MS = 8_000;

/** Reads the browser's persisted Supabase session WITHOUT writing the auth
 *  schema — this is our own localStorage, not auth.users. True when a session
 *  with a user was stored, i.e. the user had signed in on this device. */
function hasStoredAuthSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith("sb-")) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { session?: { user?: unknown } };
      if (parsed?.session?.user) return true;
    }
  } catch {
    /* unreadable storage is treated as "no stored session" */
  }
  return false;
}

/** Resolve to `value` after `ms` — the loser of the session-init race. */
function after<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authExpired, setAuthExpired] = useState(false);

  const fetchProfile = useCallback(async (userId: string): Promise<{ profile: UserProfile | null; fetchError: boolean }> => {
    const { data, error } = await (db as any)
      .from("user_profiles")
      .select(`id, name, avatar, role_id, is_active, must_change_password, last_login, created_at, roles ( id, slug, name )`)
      .eq("id", userId)
      .single();

    // Distinguish "no profile row" from a transient DB/network error
    if (error) {
      // PGRST116 = row not found — genuine missing profile
      if (error.code === "PGRST116") return { profile: null, fetchError: false };
      // Anything else = transient error — don't sign the user out
      console.error("[AuthContext] fetchProfile DB error:", error.message);
      return { profile: null, fetchError: true };
    }
    if (!data) return { profile: null, fetchError: false };

    const permissions: string[] = [];
    if (data.role_id) {
      const { data: rpData } = await (db as any)
        .from("role_permissions")
        .select(`permissions ( slug )`)
        .eq("role_id", data.role_id);

      if (rpData) {
        for (const rp of rpData as any[]) {
          if (rp.permissions?.slug) permissions.push(rp.permissions.slug);
        }
      }
    }

    const role = data.roles as any;
    return {
      fetchError: false,
      profile: {
        id: data.id,
        email: "",       // filled in by caller who has the auth session
        name: data.name ?? "",
        avatar: data.avatar,
        roleId: data.role_id ?? "",
        roleName: role?.name ?? "",
        roleSlug: role?.slug ?? "viewer",
        permissions,
        isActive: data.is_active,
        lastLogin: data.last_login,
        createdAt: data.created_at,
        mustChangePassword: data.must_change_password ?? false,
      },
    };
  }, []);

  // Shared: given a validated session, load the profile and publish user state.
  // Signs the user out only when the profile is genuinely missing or deactivated
  // (a real "no access" state) — never on a transient DB/network blip.
  const hydrateFromSession = useCallback(
    async (userId: string, email: string) => {
      const { profile, fetchError } = await fetchProfile(userId);
      if (fetchError) return; // transient error — keep existing state
      if (!profile || !profile.isActive) {
        await supabase.auth.signOut();
        setUser(null);
        setCurrentPermissions([]);
        return;
      }
      setUser({ id: userId, email, profile: { ...profile, email } });
      setCurrentPermissions(profile.permissions);
    },
    [fetchProfile],
  );

  type SessionOutcome =
    | { kind: "no-session" }
    | { kind: "expired" }
    | { kind: "timeout" }
    | { kind: "ok"; userId: string; email: string };

  // Resolve the stored session to an outcome. getSession() auto-refreshes when
  // the refresh token is usable (the SILENT-REFRESH path); getUser() then
  // validates the resulting access token against the Auth server. A dead session
  // (expired with no usable refresh token) surfaces here as an error / empty user.
  const resolveSession = useCallback(async (): Promise<SessionOutcome> => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) return { kind: "expired" };
      const session = data?.session;
      if (!session?.user) return { kind: "no-session" };
      const { data: u, error: uErr } = await supabase.auth.getUser();
      if (uErr) return { kind: "expired" };
      if (!u?.user) return { kind: "no-session" };
      return { kind: "ok", userId: u.user.id, email: u.user.email ?? "" };
    } catch {
      return { kind: "expired" };
    }
  }, []);

  // SESSION INIT — guarded so a hung getSession() (the deadlock) can never leave
  // the app spinning. Whichever of resolveSession / the 8s timer settles first
  // wins; a clean "never signed in" load is NOT reported as an expiry.
  const initAuth = useCallback(async () => {
    setIsLoading(true);
    const hadStored = hasStoredAuthSession();
    try {
      const outcome = await Promise.race<SessionOutcome>([
        resolveSession(),
        after<SessionOutcome>(SESSION_INIT_TIMEOUT_MS, { kind: "timeout" }),
      ]);

      if (outcome.kind === "ok") {
        await hydrateFromSession(outcome.userId, outcome.email);
        setAuthExpired(false);
        return;
      }

      await supabase.auth.signOut().catch(() => {});
      setUser(null);
      setCurrentPermissions([]);
      setAuthExpired(
        outcome.kind === "expired" || (outcome.kind === "timeout" && hadStored),
      );
    } finally {
      setIsLoading(false);
    }
  }, [resolveSession, hydrateFromSession]);

  // Silent re-read on auth events (tab focus, USER_UPDATED) and refreshUser —
  // no timeout/expiry logic here; that belongs to session INIT only.
  const loadUser = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setUser(null);
        setCurrentPermissions([]);
        setAuthExpired(false);
        return;
      }
      await hydrateFromSession(session.user.id, session.user.email ?? "");
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  }, [hydrateFromSession]);

  useEffect(() => {
    initAuth(); // guarded initial load

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // These events fire on every tab focus and must never remount the editor.
        // TOKEN_REFRESHED — Supabase silently rotated the JWT: no user change.
        // INITIAL_SESSION  — Supabase replays the session on tab focus in some
        //                    browser/SDK version combinations.
        // USER_UPDATED     — Profile metadata changed; the session is still valid.
        if (event === "TOKEN_REFRESHED") return;
        if (event === "INITIAL_SESSION") return;

        if (event === "SIGNED_OUT") {
          setUser(null);
          setCurrentPermissions([]);
          setIsLoading(false);
          // A runtime sign-out is a deliberate exit, not a startup expiry.
          setAuthExpired(false);
          return;
        }

        if (session?.user) {
          await loadUser(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [initAuth, loadUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (!data.user) return { error: "Login failed" };

    const { profile, fetchError } = await fetchProfile(data.user.id);
    if (fetchError) return { error: "Could not load your profile. Please try again." };
    if (!profile) return { error: "Profile not found. Contact your administrator." };
    if (!profile.isActive) {
      await supabase.auth.signOut();
      return { error: "Your account has been deactivated. Contact Super Admin." };
    }

    await db.from("user_profiles").update({ last_login: new Date().toISOString() }).eq("id", data.user.id);

    setUser({
      id: data.user.id,
      email: data.user.email ?? "",
      profile: { ...profile, email: data.user.email ?? "" },
    });
    setAuthExpired(false); // a successful login clears any prior expiry banner
    return { error: null };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (user) await loadUser();
  }, [user, loadUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        permissions: user?.profile.permissions ?? [],
        authExpired,
        signIn,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
