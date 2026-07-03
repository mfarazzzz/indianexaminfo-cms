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

  const fetchProfile = useCallback(async (userId: string): Promise<{ profile: UserProfile | null; fetchError: boolean }> => {
    const { data, error } = await (db as any)
      .from("user_profiles")
      .select(`id, name, avatar, role_id, is_active, last_login, created_at, roles ( id, slug, name )`)
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
      },
    };
  }, []);

  const loadUser = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setUser(null); return; }

      const { profile, fetchError } = await fetchProfile(session.user.id);

      // Only sign out if the profile is genuinely absent — not on transient errors
      if (fetchError) {
        // DB error: keep existing user state, just stop loading
        return;
      }
      if (!profile || !profile.isActive) {
        await supabase.auth.signOut();
        setUser(null);
        return;
      }

      setUser({
        id: session.user.id,
        email: session.user.email ?? "",
        profile: { ...profile, email: session.user.email ?? "" },
      });
    } finally {
      setIsLoading(false);
    }
  }, [fetchProfile]);

  useEffect(() => {
    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "TOKEN_REFRESHED") return;

        if (event === "SIGNED_OUT") {
          setUser(null);
          setIsLoading(false);
          return;
        }

        if (session?.user) {
          await loadUser();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [loadUser]);

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
