/**
 * OpenReportsBanner — the single "N open reader reports" line shown near the top
 * of a vacancy or exam editor (P3-2).
 *
 * Rules (owner brief):
 *   • Open = status in the shared OPEN set (src/config/messages.ts): new |
 *     in_progress | waiting_on_reader.
 *   • Hidden when N = 0.
 *   • Hidden when the signed-in user lacks handle_messages (they cannot open
 *     the Messages screen anyway, so the line would be a dead link).
 *   • Links to /messages pre-filtered by this record's entity_id.
 *
 * The count is a REAL query. Until reader_messages is applied, or for a reader
 * who is not a handle_messages holder (RLS returns 0 rows), the query yields 0
 * and the line simply does not render — it never shows a fabricated number.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePermission } from "@/hooks/usePermission";
import { P } from "@/config/permissions";
import { countOpenReportsForEntity } from "@/services/readerMessageService";

export function OpenReportsBanner({ entityId }: { entityId?: string | null }) {
  const canHandle = usePermission(P.HANDLE_MESSAGES);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!canHandle || !entityId) {
      setCount(0);
      return;
    }
    let active = true;
    countOpenReportsForEntity(entityId)
      .then((n) => { if (active) setCount(n); })
      // Fail-soft: a not-yet-applied table (or any read error) is treated as 0,
      // so the line hides instead of throwing in the editor.
      .catch(() => { if (active) setCount(0); });
    return () => { active = false; };
  }, [canHandle, entityId]);

  if (!canHandle || !entityId || count <= 0) return null;

  return (
    <div className="mb-4">
      <Link
        to={`/messages?entity_id=${encodeURIComponent(entityId)}&status=open`}
        className="inline-flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-sm font-medium text-amber-800 hover:bg-amber-100"
      >
        {count} open reader report{count === 1 ? "" : "s"}
      </Link>
    </div>
  );
}
