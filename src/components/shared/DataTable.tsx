import React from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type ColumnSizingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";

interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  isLoading?: boolean;
  emptyMessage?: string;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  className?: string;

  // ── Optional grid capabilities (P3-1) ──────────────────────────────────────
  // Every one is OFF unless the caller passes it, so the other list pages that
  // use this component are untouched.

  /** Stable row id (needed when rows are paginated server-side). */
  getRowId?: (row: TData, index: number) => string;
  /** Whole-row click (the Messages grid opens its side panel this way). */
  onRowClick?: (row: TData) => void;
  /** Sticky header row (requires a scroll container with a max height). */
  stickyHeader?: boolean;
  /**
   * SERVER-side sort: the grid is paginated, so a client sort would only ever
   * order the current page. The caller owns the state and refetches.
   */
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  /** Resizable columns: caller owns the sizing state (persist it per user). */
  enableResizing?: boolean;
  columnSizing?: ColumnSizingState;
  onColumnSizingChange?: (sizing: ColumnSizingState) => void;
  /** Hideable columns: caller owns the visibility map (persist it per user). */
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: (visibility: VisibilityState) => void;
}

export function DataTable<TData>({
  data,
  columns,
  isLoading,
  emptyMessage = "No results.",
  rowSelection,
  onRowSelectionChange,
  className,
  getRowId,
  onRowClick,
  stickyHeader,
  sorting,
  onSortingChange,
  enableResizing,
  columnSizing,
  onColumnSizingChange,
  columnVisibility,
  onColumnVisibilityChange,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
    manualSorting: true,
    state: {
      rowSelection: rowSelection ?? {},
      sorting: sorting ?? [],
      // columnSizing only when the caller controls it; the drag-info state
      // stays internal either way.
      ...(columnSizing ? { columnSizing } : {}),
      columnVisibility: columnVisibility ?? {},
    },
    onRowSelectionChange: (updater) => {
      if (!onRowSelectionChange) return;
      const next = typeof updater === "function" ? updater(rowSelection ?? {}) : updater;
      onRowSelectionChange(next);
    },
    onSortingChange: (updater) => {
      if (!onSortingChange) return;
      const next = typeof updater === "function" ? updater(sorting ?? []) : updater;
      onSortingChange(next);
    },
    onColumnSizingChange: (updater) => {
      if (!onColumnSizingChange) return;
      const next = typeof updater === "function" ? updater(columnSizing ?? {}) : updater;
      onColumnSizingChange(next);
    },
    onColumnVisibilityChange: (updater) => {
      if (!onColumnVisibilityChange) return;
      const next = typeof updater === "function" ? updater(columnVisibility ?? {}) : updater;
      onColumnVisibilityChange(next);
    },
    columnResizeMode: "onChange",
    enableColumnResizing: !!enableResizing,
    enableRowSelection: !!onRowSelectionChange,
  });

  const colCount = table.getVisibleLeafColumns().length;

  return (
    <div className={cn("overflow-hidden rounded-md border border-slate-200 bg-white", className)}>
      <div className={cn("overflow-x-auto", stickyHeader && "max-h-[70vh] overflow-y-auto")}>
        <table className="w-full border-separate border-spacing-0 text-sm" style={{ width: enableResizing ? `${table.getTotalSize()}px` : undefined }}>
          <thead className="border-b border-slate-200 bg-slate-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "relative px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500",
                        stickyHeader && "sticky top-0 z-10 bg-slate-50",
                      )}
                      style={{ width: header.getSize() }}
                      aria-sort={canSort ? (sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none") : undefined}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={() => header.column.toggleSorting(sorted === "asc")}
                          className="flex w-full items-center gap-1 text-left uppercase hover:text-slate-800"
                        >
                          <span className="flex-1">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                          <span aria-hidden className="text-slate-400">{sorted === "asc" ? "↑" : sorted === "desc" ? "↓" : "↕"}</span>
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                      {enableResizing && header.column.getCanResize() && (
                        <span
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={cn(
                            "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none hover:bg-blue-300/60",
                            header.column.getIsResizing() && "bg-blue-400",
                          )}
                          aria-hidden
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 animate-pulse rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={colCount}
                  className="px-4 py-12 text-center text-sm text-slate-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "transition-colors hover:bg-slate-50",
                    row.getIsSelected() && "bg-blue-50",
                    onRowClick && "cursor-pointer",
                  )}
                  onClick={(e) => {
                    if (!onRowClick) return;
                    // Interactive controls inside a cell keep their own job.
                    const target = e.target as HTMLElement;
                    if (target.closest("button,select,input,a,textarea,[role=button],[role=checkbox]")) return;
                    onRowClick(row.original);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-slate-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
