import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BulletinBoard, type BulletinAction } from "./BulletinBoard";
import { useAuth } from "@/hooks/useAuth";
import { P } from "@/config/permissions";
import { getErrorMessage } from "@/lib/utils";
import {
  EMPTY_BUNDLE,
  type BulletinBundle,
  type BulletinEditorState,
} from "@/lib/bulletin/model";
import {
  assignBulletinSignal,
  loadBulletin,
  markDoneByHand,
  snoozeBulletinSignal,
} from "@/services/bulletinService";

/**
 * BulletinPage — the bulletin home at `/bulletin` (build step 5).
 *
 * It is a PREVIEW ROUTE, not the default one: `/` still redirects to
 * `/dashboard` and will until the bulletin DB objects are promoted and applied
 * (docs/design/bulletin-layer1-and-cms-home.md §g steps 3–4). Nothing here
 * changes a public URL.
 *
 * `?mock=1` (DEV builds only) renders the reviewed wireframe from fixtures so
 * the screen can be reviewed and screenshotted before the migrations exist. The
 * mock path runs the same RowList / StatusChip / assembleBulletin code the unit
 * tests use, and it never touches the network: actions update local state only.
 */
export function BulletinPage() {
  const [searchParams] = useSearchParams();
  const mock = import.meta.env.DEV && searchParams.get("mock") === "1";

  const { user, permissions } = useAuth();
  const canEdit = permissions.includes(P.EDIT_ANY_POST);
  const queryClient = useQueryClient();

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [mockBundle, setMockBundle] = useState<BulletinBundle | null>(null);
  const [mockStates, setMockStates] = useState<BulletinEditorState[]>([]);

  const query = useQuery({
    queryKey: ["bulletin", "home"],
    queryFn: () => loadBulletin(),
    enabled: !mock,
  });

  // DEV-only fixtures are loaded lazily so they stay out of the production chunk.
  useEffect(() => {
    if (!mock) return;
    let active = true;
    import("@/lib/bulletin/fixtures")
      .then((m) => { if (active) setMockBundle(m.MOCK_BUNDLE); })
      .catch(() => { if (active) setMockBundle(EMPTY_BUNDLE); });
    return () => { active = false; };
  }, [mock]);

  const bundle: BulletinBundle = mock
    ? mockBundle
      ? { ...mockBundle, editorStates: [...mockBundle.editorStates, ...mockStates] }
      : EMPTY_BUNDLE
    : query.data ?? EMPTY_BUNDLE;

  const handleAction = async (signalKey: string, action: BulletinAction) => {
    const actorId = user?.id;
    if (!canEdit || !actorId) return;

    if (mock) {
      // The preview must not write to the database. Mirror the real rule set so
      // the chips behave exactly as they will once the table exists.
      const next: BulletinEditorState = {
        signal_key: signalKey,
        assignee: action === "assign" ? actorId : null,
        status: action === "snooze" ? "snoozed" : action === "done" ? "done-by-hand" : "open",
        snooze_until: action === "snooze" ? new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10) : null,
        note: action === "done" ? "Handled by hand (mock preview)" : null,
        updated_by: actorId,
        updated_at: new Date().toISOString(),
      };
      setMockStates((prev) => [...prev.filter((s) => s.signal_key !== signalKey), next]);
      toast.success(
        action === "assign" ? "Assigned to you (mock)"
        : action === "snooze" ? "Snoozed 7 days (mock)"
        : "Marked done-by-hand (mock)",
      );
      return;
    }

    setBusyKey(signalKey);
    try {
      if (action === "assign") await assignBulletinSignal(signalKey, actorId);
      else if (action === "snooze") await snoozeBulletinSignal(signalKey, actorId, 7);
      else await markDoneByHand(signalKey, actorId);
      await queryClient.invalidateQueries({ queryKey: ["bulletin"] });
      toast.success(
        action === "assign" ? "Assigned to you"
        : action === "snooze" ? "Snoozed for 7 days"
        : "Marked done-by-hand",
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyKey(null);
    }
  };

  if (query.error && !mock) {
    // A real failure is stated, never faked as an empty board.
    return (
      <div className="space-y-3">
        <h1 className="text-lg font-semibold text-slate-900">Bulletin</h1>
        <p className="border-l-2 border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-800">
          {getErrorMessage(query.error)}
        </p>
      </div>
    );
  }

  return (
    <BulletinBoard
      bundle={bundle}
      canEdit={canEdit}
      onAction={handleAction}
      busyKey={busyKey}
      loading={mock ? mockBundle === null : query.isLoading}
      mock={mock}
    />
  );
}
