import React from "react";
import { ExternalLink } from "lucide-react";
import { SITE } from "@/config/site";

/**
 * Maps CMS pillar slugs to the actual frontend route path.
 */
function getFrontendPillar(cmsPillar: string): string {
  const map: Record<string, string> = {
    "government-exam": "government-exam",
    "govt-vacancy": "govt-vacancy",
    "entrance-exam": "entrance-exam",
    "board-exam": "board-exam",
    "university-exam": "university-exam",
    "news": "news",
    // Legacy fallbacks (in case old values still exist somewhere)
    "sarkari-naukri": "government-exam",
    "sarkari-bharti": "govt-vacancy",
    "government-jobs": "govt-vacancy",
    "board-university": "board-exam",
  };
  return map[cmsPillar] ?? cmsPillar;
}

interface ViewOnSiteButtonProps {
  /** The pillar/section of the entity (e.g., "entrance-exam", "sarkari-naukri") */
  pillar: string;
  /** The category slug (optional) */
  category?: string;
  /** The item slug */
  slug: string;
  /** Whether the item is published/live — if false, shows a muted preview link */
  isPublished?: boolean;
  /** Optional: override the full path instead of constructing from pillar/category/slug */
  overridePath?: string;
  /** Size variant: sm=icon only, md=icon+text compact, lg=full button style */
  size?: "sm" | "md" | "lg";
}

/**
 * "View on Site" link that opens the live frontend URL.
 * Shows for all items that have a slug. Published items get green color, drafts get muted.
 */
export function ViewOnSiteButton({
  pillar,
  category,
  slug,
  isPublished = true,
  overridePath,
  size = "sm",
}: ViewOnSiteButtonProps) {
  if (!slug) return null;

  const frontendPillar = getFrontendPillar(pillar);
  const path = overridePath
    ? overridePath
    : [frontendPillar, category, slug].filter(Boolean).join("/");

  const href = `${SITE.frontendUrl}/${path}`;

  if (size === "lg") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
          isPublished
            ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
            : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
        }`}
        title="View on site"
      >
        <ExternalLink size={14} />
        View on Site
      </a>
    );
  }

  if (size === "md") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
          isPublished
            ? "text-green-600 hover:bg-green-50"
            : "text-slate-400 hover:bg-slate-50"
        }`}
        title="View on site"
      >
        <ExternalLink size={12} />
        <span>View</span>
      </a>
    );
  }

  // sm (default) — icon only
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center p-1.5 rounded transition-colors ${
        isPublished
          ? "text-green-600 hover:bg-green-50 hover:text-green-700"
          : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
      }`}
      title="View on site"
    >
      <ExternalLink size={14} />
    </a>
  );
}
