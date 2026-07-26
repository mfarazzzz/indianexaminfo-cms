import React from "react";
import { Navigate } from "react-router-dom";
import { useAnyPermission } from "@/hooks/usePermission";

interface Props {
  /** At least one of these permissions must be present to render children. */
  anyOf: string[];
  children: React.ReactNode;
}

/**
 * Route-level permission gate. Renders children only if the authenticated
 * user holds at least one of the listed permissions. Otherwise redirects
 * to the dashboard (same UX as the catch-all, but with intent).
 *
 * This is a defence-in-depth layer on top of RLS. Even if someone types
 * a URL they shouldn't access, they see a redirect instead of a mutation form.
 */
export function RequirePermission({ anyOf, children }: Props) {
  const hasAccess = useAnyPermission(anyOf);

  if (!hasAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
