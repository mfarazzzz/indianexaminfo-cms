import React from "react";
import { cn } from "@/lib/utils";

/**
 * RowList — the shared bordered-ROW list (docs/design/bulletin-layer1-and-cms-home.md §f).
 *
 * One component for every queue (bulletin sections, and later the vacancy and
 * exam lists) so the visual rules are stated once and cannot drift:
 *   • rows, never cards or tiles — no per-row border, no per-row background;
 *   • exactly ONE hairline (1px) between rows, none around the list;
 *   • the date column is left-aligned and first;
 *   • a column is sortable only by date or traffic — never insertion order.
 *
 * The list is a CSS grid: `columns` defines the tracks, so the header row and
 * every body row share one alignment. Cells come from `cell(item, column)`,
 * which keeps this component presentational and testable in isolation.
 */

export interface RowColumn {
  key: string;
  label: string;
  /** Grid track size, e.g. "84px" or "minmax(0,1fr)". Defaults to "auto". */
  width?: string;
  align?: "left" | "right";
  /** Which sort mode this header toggles. Only "date" and "traffic" exist. */
  sortMode?: "date" | "traffic";
}

export interface RowListSort {
  mode: "date" | "traffic";
  direction: "asc" | "desc";
  onToggle: (mode: "date" | "traffic") => void;
}

export interface RowListProps<T> {
  columns: RowColumn[];
  items: T[];
  keyOf: (item: T) => string;
  cell: (item: T, column: RowColumn) => React.ReactNode;
  onRowClick?: (item: T) => void;
  sort?: RowListSort;
  /** Shown when `items` is empty. Plain text, no illustration. */
  empty?: React.ReactNode;
  loading?: boolean;
  className?: string;
  /**
   * Floor for the row grid in px. Below it the list scrolls horizontally instead
   * of squeezing the flexible (entity) track to zero — which would silently drop
   * the row's title off the screen on a narrow window.
   */
  minWidth?: number;
}

function alignClass(align: RowColumn["align"]): string {
  return align === "right" ? "flex justify-end text-right" : "text-left";
}

export function RowList<T>({
  columns,
  items,
  keyOf,
  cell,
  onRowClick,
  sort,
  empty = "Nothing here.",
  loading = false,
  className,
  minWidth = 760,
}: RowListProps<T>) {
  const gridTemplate = columns.map((c) => c.width ?? "auto").join(" ");

  const headerRow = (
    <div
      className="grid items-center gap-3 px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500"
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {columns.map((col) => {
        const isActive = !!sort && sort.mode === col.sortMode;
        if (!sort || !col.sortMode) {
          return (
            <span key={col.key} className={cn("truncate", alignClass(col.align))}>
              {col.label}
            </span>
          );
        }
        return (
          <button
            key={col.key}
            type="button"
            onClick={() => sort.onToggle(col.sortMode!)}
            aria-pressed={isActive}
            className={cn(
              "inline-flex items-center gap-1 truncate transition-colors hover:text-slate-800",
              alignClass(col.align),
              isActive && "text-slate-900",
            )}
          >
            {col.label}
            {/* A typographic arrow, not an icon — the only glyph the header may use. */}
            {isActive && <span aria-hidden>{sort.direction === "asc" ? "↑" : "↓"}</span>}
          </button>
        );
      })}
    </div>
  );

  return (
    // divide-y gives one hairline between rows; the container carries no border
    // and no background, so nothing on screen reads as a card. The outer box only
    // scrolls — it is never drawn.
    <div className="overflow-x-auto">
    <div
      className={cn("divide-y divide-slate-100", className)}
      style={{ minWidth }}
    >
      {headerRow}

      {loading ? (
        <div className="px-3 py-6 text-sm text-slate-400">Loading…</div>
      ) : items.length === 0 ? (
        <div className="px-3 py-6 text-sm text-slate-400">{empty}</div>
      ) : (
        items.map((item) => {
          // A row is a plain grid div, never a nested <button>: a row may carry
          // its own action buttons, and an interactive element may not contain
          // another one. The board therefore renders an explicit "Open …"
          // control in the last column for keyboard users, while the row itself
          // stays clickable for mouse users.
          return (
            <div
              key={keyOf(item)}
              data-row
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              className={cn(
                "grid items-center gap-3 px-3 py-2.5 text-sm text-slate-700",
                onRowClick && "cursor-pointer transition-colors hover:bg-slate-50",
              )}
              style={{ gridTemplateColumns: gridTemplate }}
            >
              {columns.map((col) => (
                <div key={col.key} className={cn("min-w-0", alignClass(col.align))}>
                  {cell(item, col)}
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
    </div>
  );
}

/** A traffic number, right-aligned; a plain 0 when the entity has no page_traffic row. */
export function TrafficCell({ clicks }: { clicks: number }) {
  return (
    <span className={cn("tabular-nums", clicks === 0 && "text-slate-300")}>
      {clicks === 0 ? "0" : clicks.toLocaleString("en-IN")}
    </span>
  );
}
