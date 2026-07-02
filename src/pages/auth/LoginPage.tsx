import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, FlaskConical } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase/client";
import { env } from "@/config/env";

const IS_DEV_MODE =
  !env.SUPABASE_URL || env.SUPABASE_URL === "https://your-project.supabase.co";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password required"),
});
type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    const { error } = await signIn(data.email, data.password);
    if (error) {
      setServerError(error);
    } else {
      navigate("/dashboard");
    }
  };

  const handleForgotPassword = async () => {
    const email = getValues("email");
    if (!email) {
      setServerError("Enter your email first, then click Forgot Password.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) {
      setServerError(error.message);
    } else {
      setForgotSent(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#0F172A] text-lg font-bold text-white">
            IE
          </div>
          <h1 className="text-xl font-semibold text-slate-900">IndianExamInfo CMS</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to manage your content</p>
        </div>

        {/* Dev mode banner */}
        {IS_DEV_MODE && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FlaskConical size={16} className="text-amber-600" />
              <span className="text-sm font-semibold text-amber-800">Dev Mode — No Supabase required</span>
            </div>
            <p className="text-xs text-amber-700 mb-3">
              Use these demo credentials to explore the CMS locally.
            </p>
            <div className="rounded bg-amber-100 px-3 py-2 font-mono text-xs text-amber-900 space-y-0.5">
              <div><span className="text-amber-600">email:</span> admin@demo.com</div>
              <div><span className="text-amber-600">pass: </span> demo1234</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setValue("email", "admin@demo.com");
                setValue("password", "demo1234");
              }}
              className="mt-3 w-full rounded border border-amber-300 bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-200 transition-colors"
            >
              Auto-fill credentials
            </button>
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Email */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Email address
              </label>
              <input
                type="email"
                autoComplete="email"
                autoFocus
                {...register("email")}
                className="w-full rounded border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  {...register("password")}
                  className="w-full rounded border border-slate-200 px-3 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            {/* Server error */}
            {serverError && (
              <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-200">
                {serverError}
              </div>
            )}

            {/* Forgot password success */}
            {forgotSent && (
              <div className="rounded bg-green-50 px-3 py-2 text-sm text-green-700 ring-1 ring-green-200">
                Password reset link sent to your email.
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              Sign In
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-xs text-slate-500 underline-offset-2 hover:underline"
            >
              Forgot password?
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          No self-registration. Contact your Super Admin for access.
        </p>
      </div>
    </div>
  );
}
