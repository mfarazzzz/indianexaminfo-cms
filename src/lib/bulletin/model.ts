/**
 * model.ts — the bulletin's pure domain model (no React, no Supabase imports).
 *
 * Everything the bulletin home shows is derived here from three raw inputs:
 *   • the `bulletin_signals` view rows        (proposed step 3 — NOT applied yet)
 *   • the `bulletin_editor_state` rows        (proposed step 4 — NOT applied yet)
 *   • `page_traffic` rows for the newest period (promoted 20260928042556, applied on push)
 *
 * Keeping it pure is the point: the same functions serve the unit tests (with
 * fixtures) and the screen, and the rules are stated once instead of scattered
 * through JSX.
 *
 * Bucket note: `bucket` is computed by the VIEW against `current_date` (server
 * timezone = UTC, so it flips at 05:30 IST). The client never recomputes a
 * bucket — it reads the one the DB produced and displays the same as-of date
 * the query reported (see docs/design/bulletin-layer1-and-cms-home.md §c).
 */

// ── Raw shapes ───────────────────────────────────────────────────────────────

export type BulletinBucket = 'arrived' | 'upcoming' | 'backlog' | 'future';

/** One row of `bulletin_signals` (column list of the proposed view). */
export interface BulletinSignal {
  signal_key: string;
  source_table: string;           // 'exam_editions' | 'sarkari_naukri'
  exam_id: string | null;
  edition_id: string | null;
  naukri_id: string | null;
  slug: string | null;
  title: string | null;
  pillar: string;
  region: string | null;
  event_type: string;
  target_section: string | null;
  event_date: string;             // 'YYYY-MM-DD'
  offset_from_days: number;
  offset_to_days: number;
  has_content: boolean | null;
  bucket: BulletinBucket | null;
}

/** One row of `bulletin_editor_state`. */
export type EditorStatus = 'open' | 'snoozed' | 'done-by-hand';

export interface BulletinEditorState {
  signal_key: string;
  assignee: string | null;
  status: EditorStatus;
  snooze_until: string | null;    // 'YYYY-MM-DD'; required when status = 'snoozed'
  note: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

/** One `page_traffic` row (only what the bulletin needs). */
export interface TrafficRow {
  url: string;
  clicks: number;
  period_start: string;
  period_end: string;
}

/** A sarkari_naukri row that has not been verified yet — the verification queue. */
export interface VerifyCandidate {
  id: string;
  slug: string;
  title: string | null;
  state: string | null;
  official_notification_url: string | null;
  application_end_date: string | null;
}

/** The raw bundle every screen and test starts from. */
export interface BulletinBundle {
  signals: BulletinSignal[];
  editorStates: BulletinEditorState[];
  traffic: TrafficRow[];
  unverifiedVacancies: VerifyCandidate[];
  /** True when bulletin_signals / bulletin_editor_state are not in the database yet. */
  schemaPending: boolean;
  /** UTC date the bucket counts were computed against. */
  asOf: string;
}

export const EMPTY_BUNDLE: BulletinBundle = {
  signals: [],
  editorStates: [],
  traffic: [],
  unverifiedVacancies: [],
  schemaPending: false,
  asOf: '',
};

// ── Chips (§f visual rules — the ONE status hierarchy) ───────────────────────

export type ChipKind = 'live' | 'empty' | 'snoozed' | 'done-by-hand' | 'attention';

// ── Date helpers (ISO strings compare correctly as text) ────────────────────

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Whole days from `today` to `date` (negative when `date` is in the past). */
export function daysFromToday(date: string | null, today: string): number | null {
  if (!date) return null;
  const a = Date.parse(`${date}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86_400_000);
}

/**
 * Month and weekday names are spelled out here on purpose. toLocaleDateString
 * ('en-IN') renders September as "Sept" in some ICU builds and "Sep" in others,
 * and it inserts a comma after the weekday — the design wireframe says
 * "Mon 28 Sep 2026", so the strings are pinned instead of trusted to a locale.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "26 Sep" — short, left-aligned, no year noise in a dense row. */
export function formatRowDate(date: string | null): string {
  if (!date) return '—';
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Mon 28 Sep 2026" — the as-of stamp in the page header. */
export function formatAsOf(date: string): string {
  if (!date) return '';
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return `${WEEKDAYS[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ── Editor-state rules ───────────────────────────────────────────────────────

export function editorStateFor(
  signalKey: string,
  states: readonly BulletinEditorState[],
): BulletinEditorState | undefined {
  return states.find((s) => s.signal_key === signalKey);
}

/** A snooze hides work only while it is still in force (snooze_until >= today). */
export function isSnoozedActive(
  state: BulletinEditorState | undefined,
  today: string,
): boolean {
  if (!state || state.status !== 'snoozed') return false;
  // The DB CHECK guarantees snooze_until on 'snoozed'; be defensive anyway.
  return !!state.snooze_until && state.snooze_until >= today;
}

export function isDoneByHand(state: BulletinEditorState | undefined): boolean {
  return state?.status === 'done-by-hand';
}

/**
 * Is this signal still open work? (Counts on the home screen count OPEN work:
 * done-by-hand and an in-force snooze are not open.)
 */
export function isOpenWork(
  state: BulletinEditorState | undefined,
  today: string,
): boolean {
  if (isDoneByHand(state)) return false;
  if (isSnoozedActive(state, today)) return false;
  return true;
}

/**
 * The chip for one signal row.
 * `done-by-hand` and `snoozed` outrank the content signal, because the editor's
 * own action is the more useful fact on screen than `has_content`.
 */
export function chipForSignal(
  signal: BulletinSignal,
  state: BulletinEditorState | undefined,
  today: string,
): ChipKind {
  if (isDoneByHand(state)) return 'done-by-hand';
  if (isSnoozedActive(state, today)) return 'snoozed';
  return signal.has_content ? 'live' : 'empty';
}

// ── Traffic ──────────────────────────────────────────────────────────────────

/** `/sarkari-naukri/foo-2026` from `https://host/sarkari-naukri/foo-2026/`. */
export function trafficPath(url: string): string {
  let path = url.trim();
  const scheme = /^[a-z]+:\/\//i.exec(path);
  if (scheme) path = path.slice(scheme[0].length);
  const slash = path.indexOf('/');
  path = slash === -1 ? '' : path.slice(slash + 1);
  path = path.split(/[?#]/)[0];
  return path.replace(/^\/+|\/+$/g, '');
}

/**
 * Index traffic by every path segment → the largest click count seen for that
 * segment. `bulletin_signals` exposes an entity `slug` and no URL, so the slug
 * is the only join key available; matching on a path segment (rather than the
 * whole path) is what lets `/sarkari-naukri/<slug>` and
 * `/admission/<category>/<slug>/<section>` all resolve to the entity.
 */
export function buildTrafficIndex(rows: readonly TrafficRow[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const row of rows) {
    for (const segment of trafficPath(row.url).split('/')) {
      if (!segment) continue;
      const seen = index.get(segment);
      if (seen === undefined || row.clicks > seen) index.set(segment, row.clicks);
    }
  }
  return index;
}

/** Clicks for a signal — 0 when the entity has no traffic row. */
export function clicksForSignal(
  signal: BulletinSignal,
  index: ReadonlyMap<string, number>,
): number {
  if (!signal.slug) return 0;
  return index.get(signal.slug) ?? 0;
}

/** Clicks for a vacancy — 0 when absent (the verification queue ranks on this). */
export function clicksForVacancy(
  vacancy: VerifyCandidate,
  index: ReadonlyMap<string, number>,
): number {
  return index.get(vacancy.slug) ?? 0;
}

/** Only the newest reporting period is comparable; older periods must not mix. */
export function latestPeriodRows(rows: readonly TrafficRow[]): TrafficRow[] {
  if (rows.length === 0) return [];
  let newest = rows[0].period_end;
  for (const r of rows) if (r.period_end > newest) newest = r.period_end;
  return rows.filter((r) => r.period_end === newest);
}

// ── Verification queue ───────────────────────────────────────────────────────

/**
 * What blocks Verify for a vacancy — the SAME two preconditions the applied
 * trigger enforces (20260927140000_sarkari_verification_trigger.sql):
 *   official_notification_url must be an http(s) URL, and
 *   application_end_date must be set.
 * (The trigger's third condition is the publish_post permission, which is a
 * property of the user, not of the row — the UI shows that separately.)
 */
export function verifyBlockers(vacancy: VerifyCandidate): string[] {
  const blockers: string[] = [];
  const url = (vacancy.official_notification_url ?? '').trim();
  if (!/^https?:\/\//i.test(url)) blockers.push('official notification link');
  if (!vacancy.application_end_date) blockers.push('application end date');
  return blockers;
}

export function isVerifiable(vacancy: VerifyCandidate): boolean {
  return verifyBlockers(vacancy).length === 0;
}

export function chipForVacancy(vacancy: VerifyCandidate): ChipKind {
  return isVerifiable(vacancy) ? 'empty' : 'attention';
}

// ── Assembly ─────────────────────────────────────────────────────────────────

export type SortMode = 'date' | 'traffic';

/** The two — and only two — sort keys, with a direction that is always honoured. */
export interface SortSpec {
  mode: SortMode;
  direction: 'asc' | 'desc';
}

/** A signal row with everything the row needs already resolved. */
export interface SignalRow {
  signal: BulletinSignal;
  state: BulletinEditorState | undefined;
  chip: ChipKind;
  clicks: number;
  daysAway: number | null;
  open: boolean;
}

/** A verification-queue row. */
export interface VerifyRow {
  vacancy: VerifyCandidate;
  chip: ChipKind;
  clicks: number;
  blockers: string[];
}

export interface BulletinSection {
  rows: SignalRow[];
  openCount: number;
  snoozedCount: number;
  doneCount: number;
}

export interface AssembledBulletin {
  justArrived: BulletinSection;
  comingUp: BulletinSection;
  backlog: { count: number; rows: SignalRow[] };
  verificationQueue: VerifyRow[];
  trafficPeriod: { start: string; end: string } | null;
}

function toSignalRow(
  signal: BulletinSignal,
  states: readonly BulletinEditorState[],
  index: ReadonlyMap<string, number>,
  today: string,
): SignalRow {
  const state = editorStateFor(signal.signal_key, states);
  return {
    signal,
    state,
    chip: chipForSignal(signal, state, today),
    clicks: clicksForSignal(signal, index),
    daysAway: daysFromToday(signal.event_date, today),
    open: isOpenWork(state, today),
  };
}

/**
 * Sort rows for a section.
 *   traffic → clicks by `direction`, ties break on date then signal_key.
 *   date    → event_date by `direction` ('asc' = soonest first, 'desc' = newest first).
 * Snoozed rows always sink to the bottom (they are not open work); done-by-hand
 * rows are filtered out before this runs. Never insertion order.
 */
export function sortSignalRows(
  rows: readonly SignalRow[],
  sort: SortSpec = { mode: 'traffic', direction: 'desc' },
): SignalRow[] {
  const dir = sort.direction === 'asc' ? 1 : -1;
  const byKey = (a: SignalRow, b: SignalRow) =>
    a.signal.signal_key < b.signal.signal_key ? -1 : a.signal.signal_key > b.signal.signal_key ? 1 : 0;
  const byDate = (a: SignalRow, b: SignalRow) =>
    dir * (a.signal.event_date < b.signal.event_date ? -1 : a.signal.event_date > b.signal.event_date ? 1 : 0);
  const byPrimary = (a: SignalRow, b: SignalRow) =>
    sort.mode === 'traffic'
      ? dir * (a.clicks - b.clicks) || byDate(a, b) || byKey(a, b)
      : byDate(a, b) || dir * (b.clicks - a.clicks) || byKey(a, b);
  const bySnoozed = (a: SignalRow, b: SignalRow) =>
    (a.chip === 'snoozed' ? 1 : 0) - (b.chip === 'snoozed' ? 1 : 0);

  return [...rows].sort((a, b) => bySnoozed(a, b) || byPrimary(a, b));
}

function buildSection(
  bucket: BulletinBucket,
  sort: SortSpec,
  signals: readonly BulletinSignal[],
  states: readonly BulletinEditorState[],
  index: ReadonlyMap<string, number>,
  today: string,
): BulletinSection {
  const inBucket = signals
    .filter((s) => s.bucket === bucket)
    .map((s) => toSignalRow(s, states, index, today));
  const doneCount = inBucket.filter((r) => isDoneByHand(r.state)).length;
  const visible = inBucket.filter((r) => !isDoneByHand(r.state));
  return {
    rows: sortSignalRows(visible, sort),
    openCount: inBucket.filter((r) => r.open).length,
    snoozedCount: inBucket.filter((r) => r.chip === 'snoozed').length,
    doneCount,
  };
}

/**
 * Turn a raw bundle into the four sections of the bulletin home.
 * `today` defaults to the bundle's as-of date but is a parameter so tests are
 * exact — the authoritative bucket still comes from the view's `current_date`.
 */
export function assembleBulletin(
  bundle: BulletinBundle,
  opts: { sort?: SortSpec; backlogLimit?: number; today?: string } = {},
): AssembledBulletin {
  const sort: SortSpec = opts.sort ?? { mode: 'traffic', direction: 'desc' };
  const backlogLimit = opts.backlogLimit ?? 100;
  const today = opts.today ?? bundle.asOf ?? todayIso();

  const period = latestPeriodRows(bundle.traffic);
  const index = buildTrafficIndex(period);
  const trafficPeriod = period.length > 0
    ? { start: period[0].period_start, end: period[0].period_end }
    : null;

  const backlogRows = sortSignalRows(
    bundle.signals
      .filter((s) => s.bucket === 'backlog')
      .map((s) => toSignalRow(s, bundle.editorStates, index, today))
      .filter((r) => !isDoneByHand(r.state)),
    sort,
  );

  return {
    justArrived: buildSection('arrived', sort, bundle.signals, bundle.editorStates, index, today),
    comingUp: buildSection('upcoming', sort, bundle.signals, bundle.editorStates, index, today),
    backlog: {
      count: bundle.signals.filter((s) => s.bucket === 'backlog').length,
      rows: backlogRows.slice(0, backlogLimit),
    },
    verificationQueue: [...bundle.unverifiedVacancies]
      .map((v) => ({
        vacancy: v,
        chip: chipForVacancy(v),
        clicks: clicksForVacancy(v, index),
        blockers: verifyBlockers(v),
      }))
      .sort((a, b) =>
        (b.clicks - a.clicks)
        || (a.vacancy.slug < b.vacancy.slug ? -1 : a.vacancy.slug > b.vacancy.slug ? 1 : 0),
      ),
    trafficPeriod,
  };
}
