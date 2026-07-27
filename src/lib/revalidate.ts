/**
 * revalidate.ts — Trigger Next.js ISR cache revalidation on the frontend.
 *
 * Called after CMS save/publish operations to ensure the frontend
 * shows updated content immediately (instead of waiting for cache expiry).
 */

const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || "https://indianexaminfo.com";
const REVALIDATE_TOKEN = import.meta.env.VITE_REVALIDATE_TOKEN || "";

/**
 * Revalidate a specific cache tag on the frontend (e.g. "exams").
 * Non-blocking — fires and forgets. Failures are logged but never thrown.
 */
export async function revalidateTag(tag: string): Promise<void> {
  if (!REVALIDATE_TOKEN) {
    console.warn("[revalidate] No REVALIDATE_TOKEN configured — skipping.");
    return;
  }
  try {
    await fetch(`${FRONTEND_URL}/api/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidate-token": REVALIDATE_TOKEN,
      },
      body: JSON.stringify({ tag }),
    });
  } catch (err) {
    console.warn("[revalidate] Failed to revalidate tag:", tag, err);
  }
}

/**
 * Revalidate a specific path on the frontend.
 */
export async function revalidatePath(path: string): Promise<void> {
  if (!REVALIDATE_TOKEN) {
    console.warn("[revalidate] No REVALIDATE_TOKEN configured — skipping.");
    return;
  }
  try {
    await fetch(`${FRONTEND_URL}/api/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidate-token": REVALIDATE_TOKEN,
      },
      body: JSON.stringify({ path }),
    });
  } catch (err) {
    console.warn("[revalidate] Failed to revalidate path:", path, err);
  }
}

/**
 * Convenience: revalidate all exam-related caches.
 * Call after any exam create/update/publish/delete operation.
 */
export async function revalidateExams(): Promise<void> {
  await revalidateTag("exams");
}
