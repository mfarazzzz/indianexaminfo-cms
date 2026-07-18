/**
 * revalidationService.ts — Intelligent batched revalidation.
 *
 * ARCHITECTURE:
 * - Editors never see revalidation UI, tokens, or errors
 * - Saves trigger tag collection, NOT immediate revalidation
 * - A debounce window (4 seconds) groups rapid saves into one batch
 * - Only unique, affected tags are sent — no duplicates, no unrelated pages
 * - Failed batches retry automatically with exponential backoff (3 attempts)
 * - Config is read from the settings table and cached for 5 minutes
 * - If frontend isn't configured, everything is silently skipped
 *
 * FLOW:
 *   save() → enqueue tags → debounce timer resets
 *   …more saves within 4s → more tags accumulate
 *   …debounce fires → deduplicated tags sent as ONE batch request
 *   …if batch fails → retry queue with backoff
 *
 * TAG STRATEGY (Next.js App Router):
 *   exam:slug       → all pages rendering this exam
 *   pillar:slug     → listing pages for that pillar
 *   hub:contentType → hub pages (admit-card, results, etc.)
 *   exams           → global exam-related caches (homepage, search)
 */

import { db } from "@/lib/supabase/client";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type RevalidationStatus = "idle" | "publishing" | "live" | "failed";

interface RevalidationConfig {
  frontendUrl: string;
  token: string;
}

interface PendingBatch {
  tags: Set<string>;
  sources: Set<string>;
}

interface RetryJob {
  tags: string[];
  attempt: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIG — cached reads from settings table
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let cachedConfig: RevalidationConfig | null = null;
let configLoadedAt = 0;
const CONFIG_TTL = 5 * 60_000; // 5 minutes

async function getConfig(): Promise<RevalidationConfig | null> {
  const now = Date.now();
  if (cachedConfig && now - configLoadedAt < CONFIG_TTL) return cachedConfig;

  try {
    const { data } = await db
      .from("settings")
      .select("key, value")
      .in("key", ["frontend_url", "revalidate_token"]);

    if (!data || data.length < 2) return null;

    const map: Record<string, string> = {};
    for (const row of data) {
      const val = row.value;
      map[row.key] = typeof val === "string" ? val : String(val).replace(/^"|"$/g, "");
    }

    if (!map.frontend_url || !map.revalidate_token) return null;

    cachedConfig = { frontendUrl: map.frontend_url, token: map.revalidate_token };
    configLoadedAt = now;
    return cachedConfig;
  } catch {
    return null;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DEBOUNCED BATCH ACCUMULATOR
// Multiple saves within DEBOUNCE_MS accumulate into a single batch.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const DEBOUNCE_MS = 4_000; // 4 second debounce window

let pendingBatch: PendingBatch = { tags: new Set(), sources: new Set() };
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Add tags to the pending batch and reset the debounce timer.
 * When the timer fires, all accumulated tags are sent as one request.
 */
function enqueueTags(tags: string[], source: string): void {
  for (const tag of tags) pendingBatch.tags.add(tag);
  pendingBatch.sources.add(source);

  // Reset debounce — each new save extends the wait
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(flushBatch, DEBOUNCE_MS);
}

/**
 * Flush accumulated tags as a single batched revalidation.
 */
async function flushBatch(): Promise<void> {
  debounceTimer = null;

  const tags = [...pendingBatch.tags];
  const sources = [...pendingBatch.sources];

  // Reset accumulator immediately (new saves during flush go to next batch)
  pendingBatch = { tags: new Set(), sources: new Set() };

  if (tags.length === 0) return;

  const config = await getConfig();
  if (!config) return; // Frontend not configured — skip silently

  const success = await executeBatch(tags, config);

  if (!success) {
    // Queue for retry — don't log noise for transient failures
    enqueueRetry({ tags, attempt: 1 });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BATCH EXECUTION — sends deduplicated tags in one pass
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function executeBatch(tags: string[], config: RevalidationConfig): Promise<boolean> {
  let allSuccess = true;

  // Send each tag as its own revalidation call
  // (Next.js revalidateTag is per-tag, the API route processes one at a time)
  for (const tag of tags) {
    try {
      const res = await fetch(`${config.frontendUrl}/api/revalidate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-revalidate-token": config.token,
        },
        body: JSON.stringify({ tag }),
      });
      if (!res.ok) allSuccess = false;
    } catch {
      allSuccess = false;
    }
  }

  return allSuccess;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RETRY QUEUE — exponential backoff for failed batches
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS = [10_000, 30_000, 60_000]; // 10s, 30s, 60s

const retryQueue: RetryJob[] = [];
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function enqueueRetry(job: RetryJob): void {
  retryQueue.push(job);
  if (!retryTimer) scheduleNextRetry();
}

function scheduleNextRetry(): void {
  if (retryQueue.length === 0) { retryTimer = null; return; }
  const nextJob = retryQueue[0];
  const delayMs = RETRY_DELAYS[Math.min(nextJob.attempt - 1, RETRY_DELAYS.length - 1)];
  retryTimer = setTimeout(processRetries, delayMs);
}

async function processRetries(): Promise<void> {
  retryTimer = null;
  if (retryQueue.length === 0) return;

  const config = await getConfig();
  if (!config) { scheduleNextRetry(); return; }

  // Process up to 3 jobs per cycle
  const batch = retryQueue.splice(0, 3);

  for (const job of batch) {
    const success = await executeBatch(job.tags, config);
    if (!success) {
      if (job.attempt < MAX_ATTEMPTS) {
        job.attempt++;
        retryQueue.push(job);
      } else {
        // Final failure — log for admin visibility only
        console.warn("[revalidation] Batch failed after max retries:", {
          tags: job.tags,
          attempts: job.attempt,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  if (retryQueue.length > 0) scheduleNextRetry();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUBLIC API
// Called after successful saves. Completely non-blocking.
// Editors only see "Saved" — frontend publishing is invisible.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Enqueue revalidation after an exam save.
 * Only revalidates tags specific to this exam — not unrelated pages.
 *
 * Tags produced:
 *   exam:{slug}         → the exam detail page and any page embedding this exam
 *   pillar:{pillar}     → the pillar listing page (shows updated exam data)
 *   exams               → global exam data (homepage latest updates, sidebar)
 */
export function revalidateAfterExamSave(exam: {
  id: string;
  slug: string;
  pillar: string;
  categorySlug: string;
}): void {
  enqueueTags(
    [`exam:${exam.slug}`, `pillar:${exam.pillar}`, "exams"],
    `exam-save:${exam.slug}`
  );
}

/**
 * Enqueue revalidation after a content module save.
 * Only revalidates the exam page + the relevant hub page.
 *
 * Tags produced:
 *   exam:{slug}          → the exam detail page (shows module content)
 *   hub:{contentType}    → the hub page for this content type (e.g. /admit-card)
 */
export function revalidateAfterModuleSave(module: {
  examSlug: string;
  pillar: string;
  categorySlug: string;
  contentType: string;
}): void {
  enqueueTags(
    [`exam:${module.examSlug}`, `hub:${module.contentType}`],
    `module-save:${module.examSlug}:${module.contentType}`
  );
}

/**
 * Force-clear the config cache.
 * Called when an admin updates frontend integration settings.
 */
export function clearRevalidationConfigCache(): void {
  cachedConfig = null;
  configLoadedAt = 0;
}

/**
 * Enqueue revalidation after a Sarkari Naukri save.
 * Tags: sarkari-naukri (listing), sarkari-naukri:{slug} (detail page)
 */
export function revalidateAfterSarkariNaukriSave(entry: {
  slug: string;
  state?: string | null;
}): void {
  const tags = [`sarkari-naukri`, `sarkari-naukri:${entry.slug}`];
  if (entry.state) tags.push(`sarkari-naukri:state:${entry.state}`);
  enqueueTags(tags, `sarkari-naukri-save:${entry.slug}`);
}

/**
 * Admin diagnostic: how many items are pending retry.
 */
export function getRetryQueueLength(): number {
  return retryQueue.length;
}

/**
 * Admin diagnostic: how many tags are pending in the current debounce window.
 */
export function getPendingTagCount(): number {
  return pendingBatch.tags.size;
}
