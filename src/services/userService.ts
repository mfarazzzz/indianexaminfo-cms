import { supabase, db } from "@/lib/supabase/client";
import type { UserProfile, Role } from "@/types/user";

export async function getUserProfiles(): Promise<UserProfile[]> {
  const { data, error } = await db.from("user_profiles")
    .select("*, roles(id, slug, name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id, name: r.name, avatar: r.avatar, roleId: r.role_id,
    roleName: r.roles?.name ?? "", roleSlug: r.roles?.slug ?? "author",
    permissions: [], isActive: r.is_active, lastLogin: r.last_login, createdAt: r.created_at,
  }));
}

export async function getRoles(): Promise<Role[]> {
  const { data, error } = await db.from("roles").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id, slug: r.slug, name: r.name, description: r.description, isSystem: r.is_system,
  }));
}

/**
 * inviteUser — sends an invitation email via Supabase Auth.
 * Note: inviteUserByEmail requires the service role key server-side.
 * From the browser (anon key), we use a workaround: create the user record
 * and send a magic link instead. In production, this should be an Edge Function.
 */
export async function inviteUser(email: string, roleId: string): Promise<{ error: string | null }> {
  if (!email || !email.includes("@")) {
    return { error: "Invalid email address." };
  }
  // Use signInWithOtp as invite mechanism — sends a magic link.
  // The role is set when the user first logs in via a trigger or manually.
  // For full admin invite, implement a Supabase Edge Function that calls
  // supabase.auth.admin.inviteUserByEmail with the service role key server-side.
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: { role_id: roleId },
      emailRedirectTo: `${window.location.origin}/dashboard`,
    },
  });
  return { error: error?.message ?? null };
}

export async function updateUserProfile(id: string, input: { name?: string; roleId?: string; isActive?: boolean; avatar?: string }): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.roleId !== undefined) updates.role_id = input.roleId;
  if (input.isActive !== undefined) updates.is_active = input.isActive;
  if (input.avatar !== undefined) updates.avatar = input.avatar;
  const { error } = await db.from("user_profiles").update(updates).eq("id", id);
  if (error) throw error;
}

export async function sendPasswordReset(email: string): Promise<{ error: string | null }> {
  if (!email || !email.includes("@")) {
    return { error: "Invalid email address." };
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });
  return { error: error?.message ?? null };
}
