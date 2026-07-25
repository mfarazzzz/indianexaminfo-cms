import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Generate a URL-safe slug from a string */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Truncate text to n chars with ellipsis */
export function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}

/** Format a date string to "DD MMM YYYY" — safe against invalid input */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Format a date string to relative time (e.g. "2 hours ago") — safe, never negative */
export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const diff = Math.max(0, Date.now() - d.getTime());
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr);
}

/** Estimate reading time in minutes from HTML string */
export function estimateReadingTime(html: string): number {
  const text = html.replace(/<[^>]+>/g, "");
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

/** Count words in HTML content */
export function countWords(html: string): number {
  const text = html.replace(/<[^>]+>/g, "");
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Sanitize HTML from the rich editor before saving to DB.
 * Strips script tags and on* event handlers — defense-in-depth
 * (Tiptap already restricts these, but we double-check here).
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/data:text\/html/gi, "");
}

/**
 * Validate that a string is a safe internal URL path or https URL.
 * Rejects javascript: and data: URIs.
 */
export function isSafeUrl(url: string): boolean {
  if (!url) return true;
  const lower = url.toLowerCase().trim();
  if (lower.startsWith("javascript:")) return false;
  if (lower.startsWith("data:")) return false;
  if (lower.startsWith("vbscript:")) return false;
  return true;
}

/** Validate file type against allowed MIME types */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"] as const;
export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return `File type "${file.type}" is not allowed. Use JPG, PNG, WebP, GIF, or SVG.`;
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.`;
  }
  return null;
}


/**
 * Extract a human-readable error message from any error shape.
 * Handles: Error instances, Supabase PostgrestError, plain strings, unknown objects.
 * Never returns "[object Object]".
 */
export function getErrorMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  // Supabase PostgrestError shape: { message: string, details?: string, hint?: string, code?: string }
  if (typeof err === "object" && err !== null) {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
    if (typeof obj.details === "string") return obj.details;
    // Last resort: try JSON, but truncate
    try {
      const json = JSON.stringify(obj);
      return json.length > 120 ? json.slice(0, 120) + "…" : json;
    } catch {
      return "An unexpected error occurred";
    }
  }
  return String(err);
}

// ── Exam Data Deduplication: URL preview (Req 9) ──────────────────────────────

/**
 * Builds a clean URL preview from path segments, eliminating double-slash bugs.
 * Strips trailing slashes from each segment, leading slashes from the slug,
 * and joins with exactly one separator. Preserves protocol prefix.
 */
export function buildUrlPreview(
  pillar: string | null | undefined,
  category: string | null | undefined,
  slug: string
): string {
  const parts = [pillar, category, slug].filter(Boolean) as string[]
  if (parts.length === 0) return ''
  return '/' + parts.map(p => p.replace(/^\/+|\/+$/g, '')).join('/')
}
