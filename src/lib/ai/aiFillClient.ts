/**
 * aiFillClient.ts — the browser's only AI entry point.
 *
 * There is deliberately no key, no provider URL and no provider name here. The
 * CMS used to read a provider key out of the `settings` / `ai_providers` tables
 * and POST to the provider from this page, which meant the key was visible to
 * anyone who opened the dev tools on the login screen. Everything now goes to
 * the `ai-fill` Edge Function, which holds the key as a server-side secret,
 * checks the caller's permissions in the database, rate-limits per user and
 * returns the model's text.
 *
 * Failure handling: the function answers with { error: "plain words" } and a
 * 4xx/5xx status. That message is written for an intern, so it is shown as-is.
 */
import { db } from "@/lib/supabase/client";

export class AIFillError extends Error {}

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

/**
 * Send a prompt to the server-side AI and return the raw model text plus which
 * provider/model actually answered (the Settings AI board shows it).
 * `consumer` names the calling feature for the usage log (e.g. "ai-fill-tab").
 * `jsonMode` asks for a single JSON object at low temperature - the shape the
 * form auto-fill needs. Plain prose generation leaves it false.
 */
export async function generateTextWithProvider(
  prompt: string,
  consumer = "ai-fill",
  jsonMode = false,
): Promise<{ content: string; provider: string; model: string }> {
  const { data, error } = await db.functions.invoke("ai-fill", {
    body: { prompt, consumer, ...(jsonMode ? { jsonMode: true } : {}) },
  });

  if (error) {
    throw new AIFillError(
      (await messageFrom(error)) ??
        "AI could not be reached. Nothing was saved - your typing is safe.",
    );
  }

  const res = data as { content?: unknown; provider?: unknown; model?: unknown; error?: unknown } | null;
  if (res && typeof res.error === "string" && res.error.trim()) {
    throw new AIFillError(res.error);
  }
  if (!res || typeof res.content !== "string" || !res.content.trim()) {
    throw new AIFillError("AI returned an empty answer. Nothing was filled in.");
  }
  return {
    content: res.content,
    provider: typeof res.provider === "string" ? res.provider : "",
    model: typeof res.model === "string" ? res.model : "",
  };
}

export async function generateText(
  prompt: string,
  consumer = "ai-fill",
  jsonMode = false,
): Promise<string> {
  const { content } = await generateTextWithProvider(prompt, consumer, jsonMode);
  return content;
}
