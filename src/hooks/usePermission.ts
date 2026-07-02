import { useAuth } from "@/contexts/AuthContext";

/** Returns true if the current user has the given permission slug */
export function usePermission(slug: string): boolean {
  const { permissions } = useAuth();
  return permissions.includes(slug);
}

/** Returns true if the current user has ALL of the given permissions */
export function usePermissions(slugs: string[]): boolean {
  const { permissions } = useAuth();
  return slugs.every((s) => permissions.includes(s));
}

/** Returns true if the current user has ANY of the given permissions */
export function useAnyPermission(slugs: string[]): boolean {
  const { permissions } = useAuth();
  return slugs.some((s) => permissions.includes(s));
}
