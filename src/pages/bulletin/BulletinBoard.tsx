import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RowList, TrafficCell, type RowColumn } from "@/components/shared/RowList";
import { StatusChip } from "@/components/shared/StatusChip";
import {
  assembleBulletin,
  formatAsOf,
  formatRowDate,
  type BulletinBundle,
  type SignalRow,
  type SortMode,
  type SortSpec,
  type VerifyRow,
} from "@/lib/bulletin/model";

/**
 * BulletinBoard — the bulletin home screen (build step 5), rendered from a
 * BulletinBundle. Presentational on purpose: the route component decides where
 * the bundle comes from (the service, or fixtures under ?mock=1), so the same
 * markup is what the unit tests and the screenshots show.
 *
 * Sections (§f wireframe): Just arrived · Coming up · Verification queue ·
 * Backlog count + link. Visual rules are enforced by RowList/StatusChip.
 */

export type BulletinAction = "assign" | "snooze" | "done";

export interface BulletinBoardProps {
  bundle: BulletinBundle;
  /** Holds edit_any_post — the only role allowed to write bulletin_editor_state. */
  canEdit: boolean;
  onAction?: (signalKey: string, action: BulletinAction) => void;
  /** signal_key currently being written (disables its buttons). */
  busyKey?: string | null;
  loading?: boolean;
  /** True for the DEV ?mock=1 preview so the screen never claims to be live data. */
  mock?: boolean;
}

const SIGNAL_COLUMNS = (canEdit: boolean): RowColumn[] => [
  { key: "date", label: "Date", width: "72px", align: "left", sortMode: "date" },
  { key: "entity", label: "Entity", width: "minmax(0,1fr)", align: "left" },
  { key: "section", label: "Section", width: "128px", align: "left" },
  { key: "status", label: "Status", width: "112px", align: "left" },
  { key: "traffic", label: "Traffic", width: "72px", align: "right", sortMode: "traffic" },
  ...(canEdit
    ? [{ key: "actions", label: "Action", width: "168px", align: "left" as const }]
    : []),
  { key: "open", label: "", width: "20px", align: "right" as const },
];

const VERIFY_COLUMNS: RowColumn[] = [
  { key: "entity", label: "Vacancy", width: "minmax(0,1fr)", align: "left" },
  { key: "blocks", label: "Blocks Verify", width: "minmax(0,1fr)", align: "left" },
  { key: "status", label: "Status", width: "112px", align: "left" },
  // The queue is always click-ranked (the wireframe's "by traffic") and a
  // vacancy page has no signal date, so no header here is sortable.
  { key: "traffic", label: "Clicks", width: "80px", align: "right" },
  { key: "open", label: "", width: "20px", align: "right" },
];

function SectionHeading({
  title,
  hint,
  count,
  trailing,
}: {
  title: string;
  hint: string;
  count: number;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between px-3 pb-1 pt-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-900">
        {title}
        <span className="ml-2 font-normal normal-case tracking-normal text-slate-500">{hint}</span>
      </h2>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span className="tabular-nums">{count.toLocaleString("en-IN")} items</span>
        {trailing}
      </div>
    </div>
  );
}

/**
 * A queue on the board. The `<section>` carries an accessible name, so it is a
 * landmark (screen-reader users can jump straight to "Verification queue") and
 * a test can address one queue without depending on DOM order.
 */
function Section({
  title,
  hint,
  count,
  trailing,
  footnote,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  trailing?: React.ReactNode;
  footnote?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="mt-1">
      <SectionHeading title={title} hint={hint} count={count} trailing={trailing} />
      {children}
      {footnote && (
        <p className="px-3 pt-1 text-[11px] text-slate-400">{footnote}</p>
      )}
    </section>
  );
}

function ActionButtons({
  row,
  canEdit,
  busy,
  onAction,
}: {
  row: SignalRow;
  canEdit: boolean;
  busy: boolean;
  onAction?: (signalKey: string, action: BulletinAction) => void;
}) {
  if (!canEdit) return null;
  const base =
    "text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline disabled:opacity-40";
  // The row itself is clickable, so an action must not also open the editor.
  const act = (action: BulletinAction) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onAction?.(row.signal.signal_key, action);
  };
  return (
    <span className="inline-flex items-center gap-2.5">
      <button
        type="button"
        className={base}
        disabled={busy}
        onClick={act("assign")}
      >
        Assign
      </button>
      <button
        type="button"
        className={base}
        disabled={busy}
        onClick={act("snooze")}
      >
        Snooze 7d
      </button>
      <button
        type="button"
        className={base}
        disabled={busy}
        onClick={act("done")}
      >
        Done by hand
      </button>
    </span>
  );
}

/**
 * The row's real link target. A row also responds to a click anywhere on it,
 * but a clickable <div> is not keyboard-operable, so every row carries this
 * named control as well — "Open SSC CGL 2026" in the reader's tab order.
 */
function OpenLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Open ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="text-slate-300 transition-colors hover:text-slate-600"
    >
      {/* Plain chevron character, exactly as drawn in the wireframe. */}
      <span aria-hidden>▸</span>
    </button>
  );
}

export function BulletinBoard({
  bundle,
  canEdit,
  onAction,
  busyKey = null,
  loading = false,
  mock = false,
}: BulletinBoardProps) {
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortSpec>({ mode: "traffic", direction: "desc" });
  const [showBacklog, setShowBacklog] = useState(false);

  const board = assembleBulletin(bundle, { sort });

  const toggleSort = (mode: SortMode) => {
    setSort((prev) =>
      prev.mode === mode
        ? { mode, direction: prev.direction === "asc" ? "desc" : "asc" }
        : // Entering a new key starts at its useful end: most traffic first,
          // soonest deadline first.
          { mode, direction: mode === "traffic" ? "desc" : "asc" },
    );
  };

  const sortProps = { mode: sort.mode, direction: sort.direction, onToggle: toggleSort };

  const openSignal = (row: SignalRow) => {
    const id = row.signal.source_table === "sarkari_naukri" ? row.signal.naukri_id : row.signal.exam_id;
    if (!id) return;
    navigate(row.signal.source_table === "sarkari_naukri" ? `/vacancies/${id}` : `/exams/${id}`);
  };

  const signalCell = (row: SignalRow, col: RowColumn): React.ReactNode => {
    switch (col.key) {
      case "date":
        return <time className="text-slate-500">{formatRowDate(row.signal.event_date)}</time>;
      case "entity":
        return (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-slate-800">{row.signal.title ?? row.signal.slug ?? "—"}</span>
            {/* pillar / region are plain text — they may never be chips */}
            <span className="truncate text-[11px] text-slate-400">
              {[row.signal.pillar, row.signal.region].filter(Boolean).join(" · ")}
            </span>
          </span>
        );
      case "section":
        return (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-slate-600">{row.signal.target_section ?? "—"}</span>
            {row.daysAway !== null && (
              <span className="text-[11px] text-slate-400">
                {row.daysAway === 0 ? "today" : row.daysAway > 0 ? `in ${row.daysAway}d` : `${-row.daysAway}d ago`}
              </span>
            )}
          </span>
        );
      case "status":
        return <StatusChip kind={row.chip} />;
      case "traffic":
        return <TrafficCell clicks={row.clicks} />;
      case "actions":
        return (
          <ActionButtons
            row={row}
            canEdit={canEdit}
            busy={busyKey === row.signal.signal_key}
            onAction={onAction}
          />
        );
      case "open":
        return (
          <OpenLink
            label={row.signal.title ?? row.signal.slug ?? "record"}
            onClick={() => openSignal(row)}
          />
        );
      default:
        return null;
    }
  };

  const verifyCell = (row: VerifyRow, col: RowColumn): React.ReactNode => {
    switch (col.key) {
      case "entity":
        return (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-slate-800">{row.vacancy.title ?? row.vacancy.slug}</span>
            <span className="truncate text-[11px] text-slate-400">
              {["sarkari-naukri", row.vacancy.state].filter(Boolean).join(" · ")}
            </span>
          </span>
        );
      case "blocks":
        return row.blockers.length > 0 ? (
          <span className="truncate text-slate-600">
            {`fill ${row.blockers.join(" + ")}`}
          </span>
        ) : (
          <span className="text-slate-400">nothing — ready to verify</span>
        );
      case "status":
        return <StatusChip kind={row.chip} />;
      case "traffic":
        return <TrafficCell clicks={row.clicks} />;
      case "open":
        return (
          <OpenLink
            label={row.vacancy.title ?? row.vacancy.slug}
            onClick={() => navigate(`/vacancies/${row.vacancy.id}`)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Bulletin</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {bundle.asOf ? `${formatAsOf(bundle.asOf)} · buckets are computed against this UTC date` : "Buckets are computed against the database date"}
          </p>
        </div>
        <p className="text-xs text-slate-400">
          Preview route — the dashboard is still the default screen.
        </p>
      </div>

      {mock && (
        <p className="mt-3 border-l-2 border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
          Mocked data (?mock=1). Nothing here is read from or written to the database.
        </p>
      )}

      {bundle.schemaPending && !mock && (
        <p className="mt-3 border-l-2 border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          bulletin_signals and bulletin_editor_state are not in this database yet — they are
          still proposals under supabase/proposed/. Until they are promoted and applied only
          the verification queue below has real rows.
        </p>
      )}

      {/* Just arrived */}
      <Section
        title="Just arrived"
        hint="open work now"
        count={board.justArrived.openCount}
        footnote={board.justArrived.snoozedCount + board.justArrived.doneCount > 0
          ? `${board.justArrived.snoozedCount} snoozed · ${board.justArrived.doneCount} done-by-hand hidden`
          : undefined}
      >
        <RowList
          columns={SIGNAL_COLUMNS(canEdit)}
          items={board.justArrived.rows}
          keyOf={(r) => r.signal.signal_key}
          cell={signalCell}
          onRowClick={openSignal}
          sort={sortProps}
          loading={loading}
          empty="No signals have landed in their window today."
        />
      </Section>

      {/* Coming up */}
      <Section
        title="Coming up"
        hint="open work next"
        count={board.comingUp.openCount}
        footnote={board.comingUp.snoozedCount + board.comingUp.doneCount > 0
          ? `${board.comingUp.snoozedCount} snoozed · ${board.comingUp.doneCount} done-by-hand hidden`
          : undefined}
      >
        <RowList
          columns={SIGNAL_COLUMNS(canEdit)}
          items={board.comingUp.rows}
          keyOf={(r) => r.signal.signal_key}
          cell={signalCell}
          onRowClick={openSignal}
          sort={sortProps}
          loading={loading}
          empty="No signal windows open in the near future."
        />
      </Section>

      {/* Verification queue */}
      <Section
        title="Verification queue"
        hint="unverified vacancy pages, ranked by clicks"
        count={board.verificationQueue.length}
        footnote={board.verificationQueue.length > 0
          ? "Verifying needs the official notification link, the application end date and the publish_post permission."
          : undefined}
      >
        <RowList
          columns={VERIFY_COLUMNS}
          items={board.verificationQueue}
          keyOf={(r) => r.vacancy.id}
          cell={verifyCell}
          onRowClick={(r) => navigate(`/vacancies/${r.vacancy.id}`)}
          loading={loading}
          empty="Every vacancy page is verified."
        />
      </Section>

      {/* Backlog */}
      <Section
        title="Backlog"
        hint="older gaps"
        count={board.backlog.count}
        footnote={`Showing ${board.backlog.rows.length} of ${board.backlog.count}.`}
        trailing={
          <button
            type="button"
            onClick={() => setShowBacklog((v) => !v)}
            className="text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
          >
            {showBacklog ? "hide all" : "show all"}
          </button>
        }
      >
        {showBacklog && (
          <RowList
            columns={SIGNAL_COLUMNS(canEdit)}
            items={board.backlog.rows}
            keyOf={(r) => r.signal.signal_key}
            cell={signalCell}
            onRowClick={openSignal}
            sort={sortProps}
            empty="No backlog."
          />
        )}
      </Section>

      {/* Traffic provenance — the numbers only mean something for one period. */}
      <p className="mt-4 px-3 text-[11px] text-slate-400">
        {board.trafficPeriod
          ? `Traffic: Search Console clicks for ${board.trafficPeriod.start} → ${board.trafficPeriod.end}.`
          : "Traffic: no page_traffic rows loaded yet — every count reads 0. Import one in Settings → SEO."}
      </p>
    </div>
  );
}
