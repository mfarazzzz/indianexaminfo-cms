import React, { useState } from "react";
import { RefreshCw, Check, X, Loader2 } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import type { BatchResult } from "@/lib/api/frontend";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

type SyncState = "idle" | "syncing" | "success" | "error";

interface FrontendSyncProps {
  onSync: (frontendUrl: string, token: string) => Promise<BatchResult>;
  className?: string;
}

export function FrontendSync({ onSync, className }: FrontendSyncProps) {
  const { getSetting } = useSettings();
  const [state, setState] = useState<SyncState>("idle");
  const [result, setResult] = useState<BatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const handleSync = async () => {
    const frontendUrl = getSetting("frontend_url", "https://www.indianexaminfo.com");
    const token = getSetting("revalidate_token", "");

    if (!token) {
      setError("Revalidate token not configured. Set it in Settings → Frontend Integration.");
      setState("error");
      return;
    }

    setState("syncing");
    setError(null);

    try {
      const r = await onSync(frontendUrl as string, token as string);
      setResult(r);
      setLastSynced(new Date().toISOString());
      const nextState = r.failed.length === 0 ? "success" : "error";
      setState(nextState);
      if (r.failed.length > 0) {
        setError(`${r.failed.length} path(s) failed to revalidate.`);
      }
      // Auto-reset success after 5 seconds (use nextState, not stale closure)
      if (nextState === "success") {
        setTimeout(() => setState("idle"), 5000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSync}
          disabled={state === "syncing"}
          className={cn(
            "inline-flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
            state === "success"
              ? "bg-green-50 text-green-700"
              : state === "error"
              ? "bg-red-50 text-red-700"
              : "bg-blue-50 text-blue-700 hover:bg-blue-100"
          )}
        >
          {state === "syncing" ? (
            <Loader2 size={12} className="animate-spin" />
          ) : state === "success" ? (
            <Check size={12} />
          ) : state === "error" ? (
            <X size={12} />
          ) : (
            <RefreshCw size={12} />
          )}

          {state === "idle" && "Sync to Frontend"}
          {state === "syncing" && `Syncing ${result?.total ?? "…"} paths…`}
          {state === "success" && `Synced — ${result?.succeeded} paths updated`}
          {state === "error" && "Failed — Retry"}
        </button>

        {state === "error" && error && (
          <span className="text-xs text-red-600">{error}</span>
        )}
      </div>

      {lastSynced && (
        <p className="text-xs text-slate-400">
          Last synced: {formatDate(lastSynced)}
        </p>
      )}
    </div>
  );
}
