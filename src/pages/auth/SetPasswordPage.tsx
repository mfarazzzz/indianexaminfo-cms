import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { supabase, db } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { checkPassword, PASSWORD_MIN_LENGTH } from "@/lib/auth/passwordPolicy";

type Phase = "checking" | "ready" | "no-session" | "saving" | "done";

/**
 * SetPasswordPage — the screen an invited user (or a user with an admin-set
 * temporary password) lands on to set their own password.
 *
 * Flow:
 *  - The invite / recovery email link carries tokens in the URL hash. supabase-js
 *    (detectSessionInUrl defaults to true) exchanges them for a session before this
 *    component reads getSession(). If there is a session, the link was valid and the
 *    user can set a password. If there is none, the link is expired or already used.
 *  - On success we call updateUser({ password }); GoTrue rejects anything under the
 *    server-configured minimum, so the standard is enforced server-side, not only here.
 *  - We then clear must_change_password via a SECURITY DEFINER RPC (the self-update
 *    policy forbids flipping that flag directly) and route to /dashboard, which every
 *    authenticated role can reach.
 */
export function SetPasswordPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sent">("idle");
  const [resendEmail, setResendEmail] = useState("");

  // Determine whether the email link produced a valid session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Give supabase-js a beat to process tokens from the URL hash on first paint.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setPhase(data.session ? "ready" : "no-session");
    })();

    // If tokens are still being exchanged, catch the resulting sign-in event.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) setPhase((p) => (p === "no-session" || p === "checking" ? "ready" : p));
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const check = checkPassword(password);
    const localErrors = [...check.errors];
    if (password !== confirm) localErrors.push("The two passwords do not match.");
    setErrors(localErrors);
    if (localErrors.length > 0) return;

    setPhase("saving");
    // GoTrue enforces the server-side minimum here and rejects a weak password.
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setServerError(error.message);
      setPhase("ready");
      return;
    }

    // Clear the forced-change flag through the secure RPC (never a raw self-update).
    const { error: rpcError } = await (db as any).rpc("clear_must_change_password");
    if (rpcError) {
      // Password was changed; the flag clear failed. Surface it but don't trap the user.
      setServerError(
        "Password saved, but we could not finalize your account. Please sign in again."
      );
    }

    await refreshUser();
    setPhase("done");
    navigate("/dashboard", { replace: true });
  };

  const handleResend = async () => {
    setServerError(null);
    if (!resendEmail || !resendEmail.includes("@")) {
      setServerError("Enter the email your invite was sent to.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(resendEmail, {
      redirectTo: `${window.location.origin}/auth/set-password`,
    });
    if (error) {
      setServerError(error.message);
      return;
    }
    setResendState("sent");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#0F172A] text-white">
            <ShieldCheck size={22} />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Set your password</h1>
          <p className="mt-1 text-sm text-slate-500">
            Choose a password to finish setting up your account.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
          {phase === "checking" && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          )}

          {phase === "no-session" && (
            <div className="space-y-4">
              <div className="rounded bg-amber-50 px-3 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
                This link has expired or was already used. Request a new one below.
              </div>
              {resendState === "sent" ? (
                <div className="rounded bg-green-50 px-3 py-2 text-sm text-green-700 ring-1 ring-green-200">
                  If that email has an account, a new link is on its way.
                </div>
              ) : (
                <>
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {serverError && (
                    <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-200">
                      {serverError}
                    </div>
                  )}
                  <button
                    onClick={handleResend}
                    className="w-full rounded bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Send a new link
                  </button>
                </>
              )}
              <button
                onClick={() => navigate("/login")}
                className="w-full text-center text-xs text-slate-500 underline-offset-2 hover:underline"
              >
                Back to sign in
              </button>
            </div>
          )}

          {(phase === "ready" || phase === "saving" || phase === "done") && (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  New password
                </label>
                <div className="relative">
                  <input
                    type={show ? "text" : "password"}
                    autoComplete="new-password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2.5 pr-10 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Confirm password
                </label>
                <input
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded border border-slate-200 px-3 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="••••••••••"
                />
              </div>

              <p className="text-xs text-slate-500">
                At least {PASSWORD_MIN_LENGTH} characters, with a letter and a number.
              </p>

              {errors.length > 0 && (
                <ul className="space-y-1 rounded bg-red-50 px-3 py-2 text-xs text-red-600 ring-1 ring-red-200">
                  {errors.map((msg) => (
                    <li key={msg}>{msg}</li>
                  ))}
                </ul>
              )}
              {serverError && (
                <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-200">
                  {serverError}
                </div>
              )}

              <button
                type="submit"
                disabled={phase === "saving" || phase === "done"}
                className="flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {(phase === "saving" || phase === "done") && (
                  <Loader2 size={16} className="animate-spin" />
                )}
                Set password and continue
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
