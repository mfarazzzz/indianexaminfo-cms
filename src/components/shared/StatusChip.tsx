import React from "react";
import { cn } from "@/lib/utils";
import type { ChipKind } from "@/lib/bulletin/model";

/**
 * StatusChip — the ONE status-chip hierarchy (§f visual rules, binding).
 *
 * Exactly five chips exist and nothing else in the product may use a chip:
 *   ● live           the target section already has content
 *   ○ empty          signal open, no content yet
 *   ◐ snoozed        an editor pushed this work back (still visible)
 *   ✓ done-by-hand   handled outside the CMS; leaves the open-work lists
 *   ▲ attention      verification is blocked
 *
 * Rules honoured here: status is a WORD plus a SHAPE — the shape is a plain
 * typographic character, never an icon component, never an emoji. Colour is a
 * text colour only; a chip has no background and no border, so it can never
 * read as a card.
 */

const CHIPS: Record<ChipKind, { glyph: string; label: string; className: string }> = {
  live:          { glyph: "●", label: "live",          className: "text-green-700" },
  empty:         { glyph: "○", label: "empty",         className: "text-slate-400" },
  snoozed:       { glyph: "◐", label: "snoozed",       className: "text-slate-500" },
  "done-by-hand":{ glyph: "✓", label: "done-by-hand",  className: "text-slate-500" },
  attention:     { glyph: "▲", label: "attention",     className: "text-amber-700" },
};

export interface StatusChipProps {
  kind: ChipKind;
  /** Optional plain-text detail appended after the word (e.g. a date or reason). */
  detail?: string;
  className?: string;
}

export function StatusChip({ kind, detail, className }: StatusChipProps) {
  const chip = CHIPS[kind];
  return (
    <span
      // The role/aria-label keeps the meaning available without a colour-only cue.
      role="status"
      aria-label={`${chip.label}${detail ? `: ${detail}` : ""}`}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium",
        chip.className,
        className,
      )}
    >
      <span aria-hidden className="text-[10px] leading-none">{chip.glyph}</span>
      <span>{chip.label}</span>
      {detail && <span className="text-slate-400">{detail}</span>}
    </span>
  );
}
