import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Forced password change (admin-set temporary password): every protected route
  // bounces to the set-password screen until the flag is cleared. This cannot be
  // skipped by navigating directly to another route because that route is also
  // protected and lands here first. The flag is only cleared by the secure RPC
  // after the user actually sets a new password.
  if (user.profile.mustChangePassword) {
    return <Navigate to="/auth/set-password" replace />;
  }

  return <Outlet />;
}
