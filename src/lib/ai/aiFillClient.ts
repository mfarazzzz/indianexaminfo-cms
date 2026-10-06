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

/** One flagged field from the server-side schema validation (S2.3). */
export interface ExtractionIssue {
  field: string;
  reason: "low_confidence" | "not_an_option" | "bad_shape" | "no_value";
  detail: string;
}

/** Cleaned, server-validated extraction answer (see the function's templates.ts). */
export interface StructuredExtraction {
  content: {
    fields: Record<string, unknown>;
    dates: Record<string, unknown>[];
    /** S2.6: earlier notices this one merely REFERENCES — document refs, never date rows. */
    references?: { label: string; dateText: string; confidence: number; sourceQuote: string }[];
  };
  issues: ExtractionIssue[];
  provider: string;
  model: string;
  template: string;
}

/**
 * S2.3 — the ONLY way to run a notice extraction: ask the Edge Function to
 * render its own named template around the source text. The browser sends no
 * prompt, so the extraction contract cannot drift per-caller. A JSON/schema
 * failure comes back as a plain-words AIFillError ("AI could not read part of
 * the notice …"), never as a silent empty result; per-field problems come
 * back as `issues` for the review drawer (S2.4) to show.
 */
export async function generateStructured(
  template: "NOTICE_EXTRACT_V1",
  sourceText: string,
  opts?: { pillar?: string; consumer?: string },
): Promise<StructuredExtraction> {
  const { data, error } = await db.functions.invoke("ai-fill", {
    body: {
      template,
      sourceText,
      ...(opts?.pillar ? { pillar: opts.pillar } : {}),
      consumer: opts?.consumer ?? "notice-extract",
    },
  });

  if (error) {
    throw new AIFillError(
      (await messageFrom(error)) ??
        "AI could not be reached. Nothing was filled in - your typing is safe.",
    );
  }

  const res = data as {
    content?: unknown; issues?: unknown; provider?: unknown; model?: unknown;
    template?: unknown; error?: unknown;
  } | null;
  if (res && typeof res.error === "string" && res.error.trim()) {
    throw new AIFillError(res.error);
  }
  if (!res || !res.content || typeof res.content !== "object") {
    throw new AIFillError("AI returned an empty answer. Nothing was filled in.");
  }
  const content = res.content as { fields: Record<string, unknown>; dates: Record<string, unknown>[] };
  if (!content.fields || !Array.isArray(content.dates)) {
    throw new AIFillError("AI could not read part of the notice: the answer was missing its fields or dates. Nothing was filled in.");
  }
  return {
    content,
    issues: Array.isArray(res.issues) ? (res.issues as ExtractionIssue[]) : [],
    provider: typeof res.provider === "string" ? res.provider : "",
    model: typeof res.model === "string" ? res.model : "",
    template: typeof res.template === "string" ? res.template : template,
  };
}
