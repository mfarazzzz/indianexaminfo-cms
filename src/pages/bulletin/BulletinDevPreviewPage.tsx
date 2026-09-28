import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BulletinBoard } from "./BulletinBoard";
import {
  EMPTY_BUNDLE,
  type BulletinBundle,
  type BulletinEditorState,
  type EditorStatus,
} from "@/lib/bulletin/model";
import {
  MOCK_AS_OF,
  MOCK_EDITOR_STATES,
  MOCK_SIGNALS,
  MOCK_TRAFFIC,
  MOCK_UNVERIFIED_VACANCIES,
} from "@/lib/bulletin/fixtures";

/**
 * TEMPORARY DEV-ONLY SCREENSHOT ROUTE — revert before merge.
 *
 * /bulletin itself sits behind ProtectedRoute + RequirePermission, which needs a
 * real Supabase session. This route renders the SAME BulletinBoard from the same
 * fixtures the unit tests and ?mock=1 use, so a screenshot shows the real screen.
 * Registered only under import.meta.env.DEV.
 *
 *   /bulletin-preview            mocked board, actions visible (edit_any_post)
 *   /bulletin-preview?empty=1    the same component with nothing to show
 *   /bulletin-preview?readonly=1 mocked board with the action column hidden
 */

const BUNDLE: BulletinBundle = {
  asOf: MOCK_AS_OF,
  signals: MOCK_SIGNALS,
  editorStates: MOCK_EDITOR_STATES,
  traffic: MOCK_TRAFFIC,
  unverifiedVacancies: MOCK_UNVERIFIED_VACANCIES,
  schemaPending: false,
};

export default function BulletinDevPreviewPage() {
  const [params] = useSearchParams();
  const empty = params.get("empty") === "1";
  const readOnly = params.get("readonly") === "1";
  const [bundle, setBundle] = useState<BulletinBundle>(BUNDLE);

  // Mirrors what BulletinPage does in mock mode: the action mutates local state
  // only, so the board re-renders without a single DB call.
  const onAction = (signalKey: string, action: "assign" | "snooze" | "done") => {
    setBundle((prev) => {
      const existing = prev.editorStates.find((s) => s.signal_key === signalKey);
      const status: EditorStatus =
        action === "snooze" ? "snoozed" : action === "done" ? "done-by-hand" : "open";
      const next: BulletinEditorState = {
        ...(existing ?? {}),
        signal_key: signalKey,
        updated_by: "dev-preview",
        status,
        snooze_until:
          action === "snooze"
            ? new Date(Date.parse(prev.asOf ?? "") + 7 * 86400000)
                .toISOString()
                .slice(0, 10)
            : null,
        assignee: action === "assign" ? "dev-preview" : (existing?.assignee ?? null),
        note: existing?.note ?? null,
        updated_at: null,
      };
      return {
        ...prev,
        editorStates: [...prev.editorStates.filter((s) => s.signal_key !== signalKey), next],
      };
    });
  };

  if (empty) {
    return (
      <div className="min-h-screen bg-white p-6">
        <BulletinBoard bundle={{ ...EMPTY_BUNDLE, asOf: MOCK_AS_OF }} canEdit={false} mock />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <BulletinBoard
        bundle={bundle}
        canEdit={!readOnly}
        onAction={readOnly ? undefined : onAction}
        mock
      />
    </div>
  );
}
