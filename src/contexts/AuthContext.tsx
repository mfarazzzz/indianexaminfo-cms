import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { supabase } from "@/lib/supabase/client";
import { db } from "@/lib/supabase/client";
import type { AuthUser, UserProfile } from "@/types/user";
import { env } from "@/config/env";

// ---------------------------------------------------------------------------
// DEV MODE — active when Supabase URL is still the placeholder value.
// Allows local development without a real Supabase project.
// Demo credentials: admin@demo.com / demo1234
// ---------------------------------------------------------------------------
const IS_DEV_MODE =
  !env.SUPABASE_URL || env.SUPABASE_URL === "https://your-project.supabase.co";

const DEV_CREDENTIALS = { email: "admin@demo.com", password: "demo1234" };

const DEV_USER: AuthUser = {
  id: "dev-user-001",
  email: DEV_CREDENTIALS.email,
  profile: {
    id: "dev-user-001",
    name: "Demo Admin",
    avatar: null,
    roleId: "role-superadmin",
    roleName: "Super Admin",
    roleSlug: "super-admin",
    // Grant every permission in dev mode
    permissions: [
      "create_post","edit_any_post","edit_own_post","delete_post","publish_post",
      "create_exam","edit_any_exam","delete_exam","publish_exam",
      "manage_categories","manage_menus","manage_pages",
      "upload_media","delete_media",
      "manage_ads","view_own_ads","manage_ad_zones",
      "manage_users","manage_roles",
      "manage_settings","view_analytics","view_audit_log",
    ],
    isActive: true,
    lastLogin: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
};

const DEV_SESSION_KEY = "cms_dev_session";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  permissions: string[];
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── DEV MODE helpers ──────────────────────────────────────────────────────
  const devSignIn = useCallback(async (email: string, password: string) => {
    if (email === DEV_CREDENTIALS.email && password === DEV_CREDENTIALS.password) {
      sessionStorage.setItem(DEV_SESSION_KEY, "1");
      setUser(DEV_USER);
      return { error: null };
    }
    return { error: `Demo credentials: ${DEV_CREDENTIALS.email} / ${DEV_CREDENTIALS.password}` };
  }, []);

  const devSignOut = useCallback(async () => {
    sessionStorage.removeItem(DEV_SESSION_KEY);
    setUser(null);
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    const { data, error } = await (db as any)
      .from("user_profiles")
      .select(`
        id, name, avatar, role_id, is_active, last_login, created_at,
        roles ( id, slug, name ),
        role_permissions ( permissions ( slug ) )
      `)
      .eq("id", userId)
      .single();

    if (error || !data) return null;

    const permissions: string[] = [];
    if (data.role_permissions) {
      for (const rp of data.role_permissions as any[]) {
        if (rp.permissions?.slug) permissions.push(rp.permissions.slug);
      }
    }
    const role = data.roles as any;
    return {
      id: data.id, name: data.name, avatar: data.avatar, roleId: data.role_id ?? "",
      roleName: role?.name ?? "", roleSlug: role?.slug ?? "author",
      permissions, isActive: data.is_active, lastLogin: data.last_login, createdAt: data.created_at,
    };
  }, []);

  const loadUser = useCallback(async () => {
    setIsLoading(true);
    try {
      // ── DEV MODE ──────────────────────────────────────────────────────────
      if (IS_DEV_MODE) {
        if (sessionStorage.getItem(DEV_SESSION_KEY)) {
          setUser(DEV_USER);
        } else {
          setUser(null);
        }
        setIsLoading(false);
        return;
      }
      // ─────────────────────────────────────────────────────────────────────
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setUser(null);
        return;
      }

      const profile = await fetchProfile(session.user.id);
      if (!profile || !profile.isActive) {
        await supabase.auth.signOut();
        setUser(null);
        return;
      }

      setUser({ id: session.user.id, email: session.user.email ?? "", profile });
    } finally {
      setIsLoading(false);
    }
  }, [fetchProfile]);

  useEffect(() => {
    loadUser();

    // ── DEV MODE — no Supabase subscription needed ────────────────────────
    if (IS_DEV_MODE) return;
    // ─────────────────────────────────────────────────────────────────────

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // TOKEN_REFRESHED: token silently renewed — no profile reload needed
        if (event === "TOKEN_REFRESHED") return;

        if (event === "SIGNED_OUT") {
          setUser(null);
          setIsLoading(false);
          return;
        }

        // PASSWORD_RECOVERY, USER_UPDATED, SIGNED_IN (from a different tab /
        // explicit login) — reload profile to pick up role changes.
        if (session?.user) {
          await loadUser();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [loadUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    // ── DEV MODE ────────────────────────────────────────────────────────────
    if (IS_DEV_MODE) return devSignIn(email, password);
    // ────────────────────────────────────────────────────────────────────────
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (!data.user) return { error: "Login failed" };

    const profile = await fetchProfile(data.user.id);
    if (!profile) return { error: "Profile not found. Contact your administrator." };
    if (!profile.isActive) {
      await supabase.auth.signOut();
      return { error: "Your account has been deactivated. Contact Super Admin." };
    }

    // Update last_login
    await db
      .from("user_profiles")
      .update({ last_login: new Date().toISOString() })
      .eq("id", data.user.id);

    setUser({ id: data.user.id, email: data.user.email ?? "", profile });
    return { error: null };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    if (IS_DEV_MODE) return devSignOut();
    await supabase.auth.signOut();
    setUser(null);
  }, [devSignOut]);

  const refreshUser = useCallback(async () => {
    if (user) await loadUser();
  }, [user, loadUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        permissions: user?.profile.permissions ?? [],
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
