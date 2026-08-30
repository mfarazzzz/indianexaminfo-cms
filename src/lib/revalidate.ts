/**
 * revalidate.ts — Trigger Next.js ISR cache revalidation on the frontend.
 *
 * Called after CMS save/publish operations to ensure the frontend
 * shows updated content immediately (instead of waiting for cache expiry).
 */
import { toast } from "sonner";

const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || "https://indianexaminfo.com";
const REVALIDATE_TOKEN = import.meta.env.VITE_REVALIDATE_TOKEN || "";

/**
 * Surface a revalidation failure to the editor. The save itself already
 * succeeded — these messages must reassure, not alarm, and tell a
 * non-technical editor what to do next.
 */
function reportRevalidationFailure(kind: "no-token" | "config" | "transient", status?: number): void {
  if (kind === "no-token") {
    toast.error("Content saved. The live site refresh isn't set up yet — your changes are safe; tell the admin.");
  } else if (kind === "config") {
    // 401/403 — token mismatch/misconfig. Will recur on every save until an admin fixes it.
    toast.error(`Content saved. The live site didn't refresh (error ${status}) — your changes are safe; tell the admin (this needs a config fix).`);
  } else {
    // 5xx / network — likely temporary.
    toast.error("Content saved. The live site didn't refresh (temporary issue) — your changes are safe; try again in a minute or tell the admin.");
  }
}

/**
 * Revalidate a specific cache tag on the frontend (e.g. "exams").
 * Non-blocking — fires and forgets. Failures are logged but never thrown.
 */
export async function revalidateTag(tag: string): Promise<void> {
  if (!REVALIDATE_TOKEN) {
    console.error("[revalidate] No REVALIDATE_TOKEN configured — frontend will NOT update.");
    reportRevalidationFailure("no-token");
    return;
  }
  try {
    const res = await fetch(`${FRONTEND_URL}/api/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidate-token": REVALIDATE_TOKEN,
      },
      body: JSON.stringify({ tag }),
    });
    // fetch does NOT throw on 4xx/5xx — must check res.ok explicitly, or a
    // 401 token mismatch silently looks like success (root cause of months
    // of stale ISR — see AUDIT_REPORT Group 4).
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[revalidate] Tag "${tag}" failed: HTTP ${res.status}`, body.slice(0, 300));
      reportRevalidationFailure(res.status === 401 || res.status === 403 ? "config" : "transient", res.status);
    }
  } catch (err) {
    console.error("[revalidate] Network error revalidating tag:", tag, err);
    reportRevalidationFailure("transient");
  }
}

/**
 * Revalidate a specific path on the frontend.
 */
export async function revalidatePath(path: string): Promise<void> {
  if (!REVALIDATE_TOKEN) {
    console.error("[revalidate] No REVALIDATE_TOKEN configured — frontend will NOT update.");
    reportRevalidationFailure("no-token");
    return;
  }
  try {
    const res = await fetch(`${FRONTEND_URL}/api/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidate-token": REVALIDATE_TOKEN,
      },
      body: JSON.stringify({ path }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[revalidate] Path "${path}" failed: HTTP ${res.status}`, body.slice(0, 300));
      reportRevalidationFailure(res.status === 401 || res.status === 403 ? "config" : "transient", res.status);
    }
  } catch (err) {
    console.error("[revalidate] Network error revalidating path:", path, err);
    reportRevalidationFailure("transient");
  }
}

/**
 * Convenience: revalidate all exam-related caches.
 * Call after any exam create/update/publish/delete operation.
 */
export async function revalidateExams(): Promise<void> {
  await revalidateTag("exams");
}
