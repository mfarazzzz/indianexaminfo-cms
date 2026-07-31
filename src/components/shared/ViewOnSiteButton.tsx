import React from "react";
import { ExternalLink } from "lucide-react";
import { SITE } from "@/config/site";

interface ViewOnSiteButtonProps {
  /** The pillar/section of the entity (e.g., "entrance-exam", "government-exam") */
  pillar: string;
  /** The category slug (optional) */
  category?: string;
  /** The item slug */
  slug: string;
  /** Whether the item is published */
  isPublished: boolean;
  /** Optional: override the full path instead of constructing from pillar/category/slug */
  overridePath?: string;
  /** Size variant */
  size?: "sm" | "md";
}

/**
 * "View on Site" button that links to the live frontend.
 * Only renders when the item is published and has a slug.
 */
export function ViewOnSiteButton({
  pillar,
  category,
  slug,
  isPublished,
  overridePath,
  size = "sm",
}: ViewOnSiteButtonProps) {
  if (!isPublished || !slug) return null;

  const path = overridePath
    ? overridePath
    : [pillar, category, slug].filter(Boolean).join("/");

  const href = `${SITE.frontendUrl}/${path}`;

  const sizeClasses = size === "sm"
    ? "p-1.5 rounded"
    : "px-2.5 py-1.5 rounded-md gap-1.5 text-xs font-medium";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center text-green-600 hover:bg-green-50 hover:text-green-700 transition-colors ${sizeClasses}`}
      title="View on site"
    >
      <ExternalLink size={size === "sm" ? 14 : 12} />
      {size === "md" && <span>View</span>}
    </a>
  );
}
