/**
 * frontend.ts — Frontend revalidation client.
 *
 * SPEC (matches app/api/revalidate/route.ts exactly):
 *   - POST to {frontendUrl}/api/revalidate
 *   - Header: x-revalidate-token (NOT Authorization: Bearer)
 *   - Body: { path: string } | { tag: string } | {}
 *   - One path per request
 *   - 100ms delay between batched requests
 *   - Empty body = revalidate all critical paths (frontend decides which)
 */

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

async function revalidateOne(
  frontendUrl: string,
  token: string,
  body: { path?: string; tag?: string }
): Promise<RevalidateResult> {
  try {
    const res = await fetch(`${frontendUrl}/api/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidate-token": token,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `${res.status} — ${text}` };
    }
    const data = await res.json();
    return { success: true, type: data.type };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/** Revalidate a single path */
export async function revalidatePath(
  path: string,
  frontendUrl: string,
  token: string
): Promise<RevalidateResult> {
  return revalidateOne(frontendUrl, token, { path });
}

/** Revalidate by tag */
export async function revalidateTag(
  tag: string,
  frontendUrl: string,
  token: string
): Promise<RevalidateResult> {
  return revalidateOne(frontendUrl, token, { tag });
}

/** Revalidate all critical paths — sends empty body, frontend handles it */
export async function revalidateAll(
  frontendUrl: string,
  token: string
): Promise<RevalidateResult> {
  return revalidateOne(frontendUrl, token, {});
}

/** Revalidate all paths for an exam (pillar + category + exam + each content type) */
export async function revalidateExamPaths(
  exam: {
    pillar: string;
    categorySlug: string;
    examSlug: string;
    enabledContentTypes: string[];
  },
  frontendUrl: string,
  token: string
): Promise<BatchResult> {
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
    const r = await revalidateOne(frontendUrl, token, { path });
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
export async function revalidateContentPost(
  post: {
    pillar: string;
    categorySlug: string;
    examSlug: string;
    contentType: string;
    postSlug: string;
  },
  frontendUrl: string,
  token: string
): Promise<BatchResult> {
  const paths = [
    `/${post.pillar}/${post.categorySlug}/${post.examSlug}/${post.contentType}`,
    `/${post.pillar}/${post.categorySlug}/${post.examSlug}/${post.contentType}/${post.postSlug}`,
    `/${post.contentType}`, // hub page
  ];

  const result: BatchResult = { total: paths.length, succeeded: 0, failed: [] };

  for (const path of paths) {
    const r = await revalidateOne(frontendUrl, token, { path });
    if (r.success) result.succeeded++;
    else result.failed.push(`${path}: ${r.error}`);
    await delay(100);
  }

  return result;
}

/** Revalidate a blog post */
export async function revalidateBlogPost(
  section: string,
  slug: string,
  frontendUrl: string,
  token: string
): Promise<BatchResult> {
  const paths = [
    "/blog",
    `/blog/${section}`,
    `/blog/${section}/${slug}`,
  ];

  const result: BatchResult = { total: paths.length, succeeded: 0, failed: [] };

  for (const path of paths) {
    const r = await revalidateOne(frontendUrl, token, { path });
    if (r.success) result.succeeded++;
    else result.failed.push(`${path}: ${r.error}`);
    await delay(100);
  }

  return result;
}

/** Revalidate menus — they're in root layout so revalidate all */
export async function revalidateMenus(
  frontendUrl: string,
  token: string
): Promise<RevalidateResult> {
  return revalidateAll(frontendUrl, token);
}
