/**
 * NoCurrentCycle — FX1.3 empty state for an EXISTING exam that has no cycle.
 *
 * The old copy ("Save the exam first") was wrong for an existing record: the
 * exam IS saved, it just lost its edition (FX1). This shows the honest state
 * and a one-click "Create <year> cycle" action that creates the current edition
 * immediately and reloads.
 */
import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createCurrentEdition } from "@/services/entranceExamService";
import { getErrorMessage } from "@/lib/utils";

interface Props {
  examId: string;
  /** The cycle year to create (from the form's Year field). */
  year: number;
  /** Called after the cycle is created so the editor reloads. */
  onCreated: () => void | Promise<void>;
  /** Short label of the tab this banner sits in, for the message. */
  context?: string;
  /** A5: when the exam has no current cycle but a draft/other edition exists,
   *  name it and offer to activate it instead of only "create a new cycle". */
  existingDraftLabel?: string | null;
  onActivateDraft?: () => void | Promise<void>;
}

export function NoCurrentCycle({ examId, year, onCreated, context, existingDraftLabel, onActivateDraft }: Props) {
  const [creating, setCreating] = useState(false);
  const [activating, setActivating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await createCurrentEdition(examId, year);
      toast.success(`Created the ${year} cycle.`);
      await onCreated();
    } catch (err) {
      toast.error("Could not create the cycle: " + getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const handleActivate = async () => {
    if (!onActivateDraft) return;
    setActivating(true);
    try { await onActivateDraft(); }
    finally { setActivating(false); }
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-5 text-center">
      {existingDraftLabel ? (
        <>
          <p className="text-sm font-medium text-amber-800">
            No active cycle. {existingDraftLabel} exists.
          </p>
          <p className="mt-1 text-xs text-amber-700/80">
            {context ? `${context} needs an active cycle. ` : ""}
            Activate the existing one, or create a {year} cycle.
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleActivate}
              disabled={activating || creating}
              className="inline-flex items-center gap-2 rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {activating && <Loader2 size={14} className="animate-spin" />}
              Activate {existingDraftLabel}
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || activating}
              className="inline-flex items-center gap-2 rounded border border-amber-600 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-60"
            >
              {creating && <Loader2 size={14} className="animate-spin" />}
              Create {year} cycle
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-amber-800">
            This exam has no {year} cycle yet.
          </p>
          <p className="mt-1 text-xs text-amber-700/80">
            {context ? `${context} needs a cycle before it can be edited. ` : ""}
            Create one to continue — it starts empty and becomes the current cycle.
          </p>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="mt-3 inline-flex items-center gap-2 rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {creating && <Loader2 size={14} className="animate-spin" />}
            Create {year} cycle
          </button>
        </>
      )}
    </div>
  );
}
