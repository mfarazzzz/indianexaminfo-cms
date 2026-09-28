import React, { useState } from "react";
import { BulletinBoard } from "./BulletinBoard";
import { EMPTY_BUNDLE, type BulletinBundle, type BulletinEditorState, type EditorStatus } from "@/lib/bulletin/model";
import { MOCK_SIGNALS, MOCK_EDITOR_STATES, MOCK_TRAFFIC, MOCK_UNVERIFIED_VACANCIES, MOCK_AS_OF } from "@/lib/bulletin/fixtures";

/**
 * TEMPORARY DEV-ONLY SCREENSHOT ROUTE — revert before merge.
 *
 * /bulletin itself sits behind ProtectedRoute + RequirePermission, which needs a
 * real Supabase session. This route renders the SAME BulletinBoard from the same
 * fixtures the unit tests and ?mock=1 use, so screenshots show the real screen.
 * It is registered only under import.meta.env.DEV.
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
  const [bundle, setBundle] = useState<BulletinBundle>(BUNDLE);

  const onAction = (signalKey: string, action: "assign" | "snooze" | "done") => {
    setBundle((prev) => {
      const today = prev.asOf;
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
            ? new Date(Date.parse(today) + 7 * 86400000).toISOString().slice(0, 10)
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

  return (
    <div className="min-h-screen bg-white p-6">
      <p className="mb-2 text-[11px] font-medium text-amber-700">
        Temporary dev preview route for screenshots — identical to /bulletin?mock=1 without requiring sign-in.
      </p>
      <BulletinBoard bundle={bundle} canEdit onAction={onAction} mock />
      <p className="mt-6 text-[11px] text-slate-400">
        Empty-state capture below (same component, no rows).
      </p>
      <BulletinBoard bundle={{ ...EMPTY_BUNDLE, asOf: MOCK_AS_OF }} canEdit={false} mock />
    </div>
  );
}
