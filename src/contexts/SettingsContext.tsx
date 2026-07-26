import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { db } from "@/lib/supabase/client";
import { supabase } from "@/lib/supabase/client";
import type { SettingsMap } from "@/types/settings";

interface SettingsContextValue {
  settings: Partial<SettingsMap>;
  isLoading: boolean;
  getSetting: <K extends keyof SettingsMap>(key: K, fallback?: SettingsMap[K]) => SettingsMap[K] | undefined;
  updateSetting: (key: string, value: unknown) => Promise<{ error: string | null }>;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Partial<SettingsMap>>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    const { data, error } = await db.from("settings").select("key, value");
    if (error) {
      console.warn("[SettingsContext] Failed to load settings:", error.message);
      // Don't crash — use defaults. Components call getSetting(key, fallback).
    }
    if (data) {
      const map: Partial<SettingsMap> = {};
      for (const row of data as any[]) {
        (map as Record<string, unknown>)[row.key] = row.value;
      }
      setSettings(map);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Wait for auth session to be available before loading settings.
    // This ensures RLS policies that depend on auth.uid() work correctly,
    // allowing sensitive settings (like API keys) to be returned.
    let cancelled = false;

    async function init() {
      // getSession() resolves once the session is restored from storage
      await supabase.auth.getSession();
      if (!cancelled) await loadSettings();
    }

    init();

    // Re-load settings when auth state changes (login/logout)
    // so that sensitive settings become available after sign-in
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (cancelled) return;
        if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
          await loadSettings();
        }
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadSettings]);

  const getSetting = useCallback(
    <K extends keyof SettingsMap>(key: K, fallback?: SettingsMap[K]) => {
      const val = (settings as Record<string, unknown>)[key as string];
      // Return fallback if value is undefined OR null (jsonb null from DB)
      return (val != null ? val : fallback) as SettingsMap[K] | undefined;
    },
    [settings]
  );

  const updateSetting = useCallback(async (key: string, value: unknown) => {
    const { error } = await db
      .from("settings")
      .upsert({
        key,
        value: value as never,
        label: key.replace(/_/g, " "),
        group: "general",
        is_sensitive: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });
    if (error) return { error: error.message };
    setSettings((prev) => ({ ...prev, [key]: value as never }));
    return { error: null };
  }, []);

  return (
    <SettingsContext.Provider
      value={{ settings, isLoading, getSetting, updateSetting, refreshSettings: loadSettings }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
