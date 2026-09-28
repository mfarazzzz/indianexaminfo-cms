/**
 * frontend.ts — Frontend revalidation client.
 *
 * The browser does NOT call the frontend any more. It calls the
 * `revalidate-frontend` edge function, which holds the token and forwards the
 * request. Reason: the token used to live in the CMS `.env`
 * (VITE_REVALIDATE_TOKEN), and Vite inlines `import.meta.env.*` into the built
 * bundle - so every visitor of the CMS had the cache-busting secret. S0-1d of
 * the 28 Sep brief. The token is now read from settings by the function.
 *
 * Contract with supabase/functions/revalidate-frontend:
 *   body { tag }        → revalidate one cache tag
 *   body { path }       → revalidate one path   (authenticated callers only)
 *   body {}             → revalidate the critical paths (authenticated only)
 *   reply { ok, status, type }
 */

import { db } from "@/lib/supabase/client";

export interface RevalidateResult {
  success: boolean;
  type?: "path" | "tag" | "all";
  error?: string;
}

export interface BatchResult {
  total: number;
  succeeded: number;
  failed: string[];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Pull the function's own error text out of a FunctionsHttpError, if present. */
async function messageFrom(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: unknown } | null)?.context;
  if (typeof Response !== "undefined" && ctx instanceof Response) {
    try {
      const body = (await ctx.json()) as { error?: unknown };
      if (typeof body?.error === "string" && body.error.trim()) return body.error;
    } catch {
      return null;
    }
  }
  const msg = (error as { message?: unknown } | null)?.message;
  return typeof msg === "string" && msg.trim() ? msg : null;
}

async function invokeRevalidate(payload: { tag?: string; path?: string }): Promise<RevalidateResult> {
  try {
    const { data, error } = await db.functions.invoke("revalidate-frontend", { body: payload });
    if (error) {
      return { success: false, error: (await messageFrom(error)) ?? "Revalidation request failed." };
    }
    const res = (data ?? {}) as { ok?: boolean; status?: number; type?: string; error?: string };
    if (res.ok === false) {
      return {
        success: false,
        error: res.error ?? `The live site did not accept the refresh${res.status ? ` (status ${res.status})` : ""}.`,
      };
    }
    const type = res.type === "tag" || res.type === "path" || res.type === "all" ? res.type : undefined;
    return { success: true, type };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Revalidate a single path */
export async function revalidatePath(path: string): Promise<RevalidateResult> {
  return invokeRevalidate({ path });
}

/** Revalidate by tag */
export async function revalidateTag(tag: string): Promise<RevalidateResult> {
  return invokeRevalidate({ tag });
}

/** Revalidate all critical paths — the function decides which, with the frontend */
export async function revalidateAll(): Promise<RevalidateResult> {
  return invokeRevalidate({});
}

/** Revalidate all paths for an exam (pillar + category + exam + each content type) */
export async function revalidateExamPaths(exam: {
  pillar: string;
  categorySlug: string;
  examSlug: string;
  enabledContentTypes: string[];
}): Promise<BatchResult> {
  const paths = [
    `/${exam.pillar}`,
    `/${exam.pillar}/${exam.categorySlug}`,
    `/${exam.pillar}/${exam.categorySlug}/${exam.examSlug}`,
    ...exam.enabledContentTypes.map(
      (ct) => `/${exam.pillar}/${exam.categorySlug}/${exam.examSlug}/${ct}`
    ),
  ];

  const result: BatchResult = { total: paths.length, succeeded: 0, failed: [] };

  for (const path of paths) {
    const r = await invokeRevalidate({ path });
    if (r.success) {
      result.succeeded++;
    } else {
      result.failed.push(`${path}: ${r.error}`);
    }
    await delay(100);
  }

  return result;
}

/** Revalidate a specific content post */
export async function revalidateContentPost(post: {
  pillar: string;
  categorySlug: string;
  examSlug: string;
  contentType: string;
  postSlug: string;
}): Promise<BatchResult> {
  const paths = [
    `/${post.pillar}/${post.categorySlug}/${post.examSlug}/${post.contentType}`,
    `/${post.pillar}/${post.categorySlug}/${post.examSlug}/${post.contentType}/${post.postSlug}`,
    `/${post.contentType}`, // hub page
  ];

  const result: BatchResult = { total: paths.length, succeeded: 0, failed: [] };

  for (const path of paths) {
    const r = await invokeRevalidate({ path });
    if (r.success) result.succeeded++;
    else result.failed.push(`${path}: ${r.error}`);
    await delay(100);
  }

  return result;
}

/** Revalidate a blog post */
export async function revalidateBlogPost(section: string, slug: string): Promise<BatchResult> {
  const paths = [
    "/blog",
    `/blog/${section}`,
    `/blog/${section}/${slug}`,
  ];

  const result: BatchResult = { total: paths.length, succeeded: 0, failed: [] };

  for (const path of paths) {
    const r = await invokeRevalidate({ path });
    if (r.success) result.succeeded++;
    else result.failed.push(`${path}: ${r.error}`);
    await delay(100);
  }

  return result;
}

/** Revalidate menus — they're in root layout so revalidate all */
export async function revalidateMenus(): Promise<RevalidateResult> {
  return revalidateAll();
}
