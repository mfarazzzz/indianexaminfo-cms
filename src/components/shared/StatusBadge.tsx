import React from "react";
import { cn } from "@/lib/utils";

type Status =
  | "upcoming" | "active" | "registration-open" | "registration-closed"
  | "result-declared" | "completed" | "ongoing"
  | "draft" | "review" | "published" | "unpublished"
  | "pending-review" | "paused" | "rejected"
  | "connected" | "disconnected"
  | string;

const STATUS_STYLES: Record<string, string> = {
  // Exam status
  upcoming:             "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  active:               "bg-green-50 text-green-700 ring-1 ring-green-200",
  "registration-open":  "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  "registration-closed":"bg-gray-50 text-gray-600 ring-1 ring-gray-200",
  "result-declared":    "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
  completed:            "bg-gray-50 text-gray-600 ring-1 ring-gray-200",
  ongoing:              "bg-teal-50 text-teal-700 ring-1 ring-teal-200",
  // Content status
  draft:                "bg-gray-50 text-gray-600 ring-1 ring-gray-200",
  review:               "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200",
  published:            "bg-green-50 text-green-700 ring-1 ring-green-200",
  unpublished:          "bg-gray-50 text-gray-500 ring-1 ring-gray-200",
  // Campaign status
  "pending-review":     "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  paused:               "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  rejected:             "bg-red-50 text-red-700 ring-1 ring-red-200",
  // Misc
  connected:            "bg-green-50 text-green-700 ring-1 ring-green-200",
  disconnected:         "bg-red-50 text-red-700 ring-1 ring-red-200",
};

const DOTS: Record<string, string> = {
  active:               "bg-green-500",
  "registration-open":  "bg-emerald-500",
  published:            "bg-green-500",
  connected:            "bg-green-500",
  review:               "bg-yellow-500",
  "pending-review":     "bg-amber-500",
  rejected:             "bg-red-500",
  disconnected:         "bg-red-500",
};

interface StatusBadgeProps {
  status: Status;
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({ status, showDot = false, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? "bg-gray-50 text-gray-600 ring-1 ring-gray-200";
  const dotColor = DOTS[status];
  const label = status.replace(/-/g, " ");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium capitalize",
        style,
        className
      )}
    >
      {showDot && dotColor && (
        <span className={cn("h-1.5 w-1.5 rounded-full", dotColor)} />
      )}
      {label}
    </span>
  );
}
