/**
 * revalidate.ts — ask the live site to refresh after a CMS save.
 *
 * Called after CMS save/publish operations so the frontend shows updated content
 * immediately instead of waiting for cache expiry.
 *
 * The request goes to the `revalidate-frontend` Edge Function (see
 * src/lib/api/frontend.ts). This module used to read VITE_REVALIDATE_TOKEN from
 * the CMS environment and call the frontend directly - which put the cache
 * -busting secret inside the built bundle. It no longer holds any secret.
 *
 * Editor experience: a save that succeeded is never reported as a failure. The
 * refresh is best-effort, and the message says so in plain words.
 */
import { toast } from "sonner";
import { revalidatePath as revalidatePathOnFunction, revalidateTag as revalidateTagOnFunction } from "@/lib/api/frontend";

function reportRevalidationFailure(detail?: string): void {
  // The function's own message is written for an editor ("… the admin must set
  // the token"), so it is shown rather than replaced by a generic retry hint.
  toast.error(
    `Content saved. ${detail ?? "The live site didn't refresh — your changes are safe; tell the admin."}`,
  );
}

/**
 * Revalidate a specific cache tag on the frontend (e.g. "exams").
 * Non-blocking — failures are surfaced as a toast, never thrown.
 */
export async function revalidateTag(tag: string): Promise<void> {
  const result = await revalidateTagOnFunction(tag);
  if (!result.success) {
    console.error(`[revalidate] Tag "${tag}" failed:`, result.error);
    reportRevalidationFailure(result.error);
  }
}

/** Revalidate a specific path on the frontend. */
export async function revalidatePath(path: string): Promise<void> {
  const result = await revalidatePathOnFunction(path);
  if (!result.success) {
    console.error(`[revalidate] Path "${path}" failed:`, result.error);
    reportRevalidationFailure(result.error);
  }
}

/**
 * Convenience: revalidate the exam caches.
 * Call after any exam create/update/publish/delete operation.
 *
 * ⚠️ TEMPORARY WORKAROUND (debounce), not the real fix.
 * Root cause: handleSave() performs TWO writes — updateExamIdentity() AND
 * updateEdition() — and each service fn independently calls revalidateExams(),
 * firing two identical revalidation requests per save. This 400ms debounce
 * collapses them into one, but it is timing-based and WILL fail on a slow
 * connection (if the two calls land >400ms apart, the duplicate returns).
 *
 * Proper fix (deferred — Part C): remove revalidateExams() from the individual
 * service functions and call it ONCE in handleSave after BOTH writes complete.
 * Then this debounce can be deleted.
 */
let _examsRevalidateTimer: ReturnType<typeof setTimeout> | null = null;

export async function revalidateExams(): Promise<void> {
  if (_examsRevalidateTimer) clearTimeout(_examsRevalidateTimer);
  _examsRevalidateTimer = setTimeout(() => {
    _examsRevalidateTimer = null;
    void revalidateTag("exams");
  }, 400);
}
