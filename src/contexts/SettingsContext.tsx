import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { db } from "@/lib/supabase/client";
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
    loadSettings();
  }, [loadSettings]);

  const getSetting = useCallback(
    <K extends keyof SettingsMap>(key: K, fallback?: SettingsMap[K]) => {
      const val = (settings as Record<string, unknown>)[key as string];
      return (val !== undefined ? val : fallback) as SettingsMap[K] | undefined;
    },
    [settings]
  );

  const updateSetting = useCallback(async (key: string, value: unknown) => {
    const { error } = await db
      .from("settings")
      .update({ value: value as never, updated_at: new Date().toISOString() })
      .eq("key", key);
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
