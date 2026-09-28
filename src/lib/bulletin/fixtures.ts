/**
 * fixtures.ts — mocked bulletin data for (a) the unit tests and (b) the DEV-only
 * `/bulletin?mock=1` preview, so the screen can be reviewed and screenshotted
 * before bulletin_signals / bulletin_editor_state are promoted and page_traffic
 * has any rows.
 *
 * Shapes are exactly the columns of the proposed view (see
 * supabase/proposed/bulletin_rules_and_signals.sql) so the mock can never drift
 * into a fantasy the real query cannot produce.
 */
import type {
  BulletinBundle,
  BulletinEditorState,
  BulletinSignal,
  TrafficRow,
  VerifyCandidate,
} from './model';

/** Fixed as-of so the mock renders the same picture on every run. */
export const MOCK_AS_OF = '2026-09-28';

const sig = (over: Partial<BulletinSignal> & Pick<BulletinSignal, 'signal_key'>): BulletinSignal => ({
  source_table: 'exam_editions',
  exam_id: '00000000-0000-0000-0000-000000000001',
  edition_id: '00000000-0000-0000-0000-0000000000e1',
  naukri_id: null,
  slug: 'ssc-cgl-2026',
  title: 'SSC CGL 2026',
  pillar: 'government-exam',
  region: null,
  event_type: 'result',
  target_section: 'result',
  event_date: '2026-10-04',
  offset_from_days: -7,
  offset_to_days: 3,
  has_content: false,
  bucket: 'upcoming',
  ...over,
});

export const MOCK_SIGNALS: BulletinSignal[] = [
  // ── Just arrived (bucket = arrived, event date on or before today) ─────────
  sig({
    signal_key: 'sarkari_naukri:11111111-1111-1111-1111-111111111101:admit_card:2026-09-26:admit_card_url',
    source_table: 'sarkari_naukri', exam_id: null, edition_id: null,
    naukri_id: '11111111-1111-1111-1111-111111111101',
    slug: 'chhattisgarh-health-ambulance-driver-2026',
    title: 'Chhattisgarh Health Dept — Ambulance Driver 2026',
    pillar: 'sarkari-naukri', region: 'chhattisgarh',
    event_type: 'admit_card', target_section: 'admit_card_url',
    event_date: '2026-09-26', has_content: false, bucket: 'arrived',
  }),
  sig({
    signal_key: 'exam_editions:00000000-0000-0000-0000-0000000000e2:result:2026-09-27:result',
    edition_id: '00000000-0000-0000-0000-0000000000e2',
    slug: 'ssc-chsl-2026', title: 'SSC CHSL 2026',
    event_date: '2026-09-27', has_content: true, bucket: 'arrived',
  }),
  sig({
    signal_key: 'exam_editions:00000000-0000-0000-0000-0000000000e3:answer_key:2026-09-25:answer-key',
    edition_id: '00000000-0000-0000-0000-0000000000e3',
    slug: 'ibps-po-2026', title: 'IBPS PO Prelims 2026', pillar: 'entrance-exam',
    event_type: 'answer_key', target_section: 'answer-key',
    event_date: '2026-09-25', has_content: false, bucket: 'arrived',
  }),
  sig({
    signal_key: 'exam_editions:00000000-0000-0000-0000-0000000000e4:result:2026-09-24:result',
    edition_id: '00000000-0000-0000-0000-0000000000e4',
    slug: 'bihar-board-inter-2026', title: 'Bihar Board Inter 2026', pillar: 'board-exam',
    event_date: '2026-09-24', has_content: false, bucket: 'arrived',
  }),

  // ── Coming up (bucket = upcoming; traffic decides the default order) ───────
  sig({
    signal_key: 'exam_editions:00000000-0000-0000-0000-0000000000e1:result:2026-10-04:result',
    slug: 'ssc-cgl-2026', title: 'SSC CGL 2026',
    event_date: '2026-10-04', has_content: true, bucket: 'upcoming',
  }),
  sig({
    signal_key: 'sarkari_naukri:11111111-1111-1111-1111-111111111102:application_end:2026-10-02:application_url',
    source_table: 'sarkari_naukri', exam_id: null, edition_id: null,
    naukri_id: '11111111-1111-1111-1111-111111111102',
    slug: 'up-police-constable-2026', title: 'UP Police Constable Recruitment 2026',
    pillar: 'sarkari-naukri', region: 'uttar-pradesh',
    event_type: 'application_end', target_section: 'application_url',
    event_date: '2026-10-02', has_content: true, bucket: 'upcoming',
  }),
  sig({
    signal_key: 'exam_editions:00000000-0000-0000-0000-0000000000e5:admit_card:2026-10-01:admit-card',
    edition_id: '00000000-0000-0000-0000-0000000000e5',
    slug: 'ibps-po-mains-2026', title: 'IBPS PO Mains 2026', pillar: 'entrance-exam',
    event_type: 'admit_card', target_section: 'admit-card',
    event_date: '2026-10-01', has_content: false, bucket: 'upcoming',
  }),
  sig({
    signal_key: 'exam_editions:00000000-0000-0000-0000-0000000000e6:notification:2026-09-30:notification',
    edition_id: '00000000-0000-0000-0000-0000000000e6',
    slug: 'nta-neet-ug-2026', title: 'NEET UG 2026', pillar: 'entrance-exam',
    event_type: 'notification', target_section: 'notification',
    event_date: '2026-09-30', has_content: false, bucket: 'upcoming',
  }),

  // ── Backlog (window closed, still no content) ──────────────────────────────
  sig({
    signal_key: 'exam_editions:00000000-0000-0000-0000-0000000000e7:result:2026-08-15:result',
    edition_id: '00000000-0000-0000-0000-0000000000e7',
    slug: 'upsc-cse-2026', title: 'UPSC CSE Prelims 2026',
    event_date: '2026-08-15', has_content: false, bucket: 'backlog',
  }),
  sig({
    signal_key: 'exam_editions:00000000-0000-0000-0000-0000000000e8:admit_card:2026-07-02:admit-card',
    edition_id: '00000000-0000-0000-0000-0000000000e8',
    slug: 'jee-main-session-2-2026', title: 'JEE Main Session 2 2026', pillar: 'entrance-exam',
    event_type: 'admit_card', target_section: 'admit-card',
    event_date: '2026-07-02', has_content: false, bucket: 'backlog',
  }),
  sig({
    signal_key: 'sarkari_naukri:11111111-1111-1111-1111-111111111103:result:2026-06-20:result_url',
    source_table: 'sarkari_naukri', exam_id: null, edition_id: null,
    naukri_id: '11111111-1111-1111-1111-111111111103',
    slug: 'rrb-ntpc-2026', title: 'RRB NTPC 2026',
    pillar: 'sarkari-naukri', region: 'india',
    event_type: 'result', target_section: 'result_url',
    event_date: '2026-06-20', has_content: false, bucket: 'backlog',
  }),

  // ── Future (window not open yet — never shown on the home board) ───────────
  sig({
    signal_key: 'exam_editions:00000000-0000-0000-0000-0000000000e9:exam_written:2026-12-10:exam',
    edition_id: '00000000-0000-0000-0000-0000000000e9',
    slug: 'cat-2026', title: 'CAT 2026', pillar: 'entrance-exam',
    event_type: 'exam_written', target_section: 'exam',
    event_date: '2026-12-10', has_content: false, bucket: 'future',
  }),
];

export const MOCK_EDITOR_STATES: BulletinEditorState[] = [
  {
    signal_key: 'exam_editions:00000000-0000-0000-0000-0000000000e3:answer_key:2026-09-25:answer-key',
    assignee: '00000000-0000-0000-0000-00000000aaaa',
    status: 'snoozed',
    snooze_until: '2026-10-05',
    note: 'Waiting for the official key PDF',
    updated_by: '00000000-0000-0000-0000-00000000aaaa',
    updated_at: '2026-09-27T09:15:00Z',
  },
  {
    signal_key: 'exam_editions:00000000-0000-0000-0000-0000000000e4:result:2026-09-24:result',
    assignee: null,
    status: 'done-by-hand',
    snooze_until: null,
    note: 'Result link pasted into the editor, not yet saved',
    updated_by: '00000000-0000-0000-0000-00000000aaaa',
    updated_at: '2026-09-26T18:02:00Z',
  },
  // An expired snooze — the row must come back as open work.
  {
    signal_key: 'exam_editions:00000000-0000-0000-0000-0000000000e7:result:2026-08-15:result',
    assignee: null,
    status: 'snoozed',
    snooze_until: '2026-09-20',
    note: null,
    updated_by: '00000000-0000-0000-0000-00000000aaaa',
    updated_at: '2026-09-13T11:00:00Z',
  },
];

/**
 * Two reporting periods on purpose: the board must rank on the NEWEST one only
 * (2026-08-29 → 2026-09-27), never mix it with the previous month.
 */
export const MOCK_TRAFFIC: TrafficRow[] = [
  { url: 'https://www.indianexaminfo.com/admission/management/ssc-cgl-2026/result', clicks: 1200, period_start: '2026-08-29', period_end: '2026-09-27' },
  { url: 'https://www.indianexaminfo.com/sarkari-naukri/up-police-constable-2026', clicks: 900, period_start: '2026-08-29', period_end: '2026-09-27' },
  { url: 'https://www.indianexaminfo.com/admission/engineering/ibps-po-mains-2026/admit-card', clicks: 640, period_start: '2026-08-29', period_end: '2026-09-27' },
  { url: 'https://www.indianexaminfo.com/sarkari-naukri/chhattisgarh-health-ambulance-driver-2026', clicks: 186, period_start: '2026-08-29', period_end: '2026-09-27' },
  { url: 'https://www.indianexaminfo.com/sarkari-naukri/bihar-mgnrega-rozgar-sewak-2026', clicks: 72, period_start: '2026-08-29', period_end: '2026-09-27' },
  { url: 'https://www.indianexaminfo.com/sarkari-naukri/rajasthan-health-dept-radiographer-2026', clicks: 47, period_start: '2026-08-29', period_end: '2026-09-27' },
  // Stale period — must be ignored by latestPeriodRows().
  { url: 'https://www.indianexaminfo.com/sarkari-naukri/up-police-constable-2026', clicks: 9999, period_start: '2026-07-30', period_end: '2026-08-28' },
];

export const MOCK_UNVERIFIED_VACANCIES: VerifyCandidate[] = [
  {
    id: '22222222-2222-2222-2222-222222222201',
    slug: 'up-swasthya-vibhag-ambulance-driver-2026',
    title: 'UP Swasthya Vibhag — Ambulance Driver 2026',
    state: 'uttar-pradesh',
    official_notification_url: null,
    application_end_date: null,
  },
  {
    id: '22222222-2222-2222-2222-222222222202',
    slug: 'bihar-mgnrega-rozgar-sewak-2026',
    title: 'Bihar MGNREGA Rozgar Sewak 2026',
    state: 'bihar',
    official_notification_url: 'https://labourresources.bihar.gov.in',
    application_end_date: null,
  },
  {
    id: '22222222-2222-2222-2222-222222222203',
    slug: 'rajasthan-health-dept-radiographer-2026',
    title: 'Rajasthan Health Dept — Radiographer 2026',
    state: 'rajasthan',
    official_notification_url: 'https://www.rajswasthya.nic.in',
    application_end_date: '2026-10-15',
  },
  {
    id: '22222222-2222-2222-2222-222222222204',
    slug: 'mp-high-court-junior-secretary-2026',
    title: 'MP High Court — Junior Secretary 2026',
    state: 'madhya-pradesh',
    official_notification_url: null,
    application_end_date: '2026-10-08',
  },
];

export const MOCK_BUNDLE: BulletinBundle = {
  signals: MOCK_SIGNALS,
  editorStates: MOCK_EDITOR_STATES,
  traffic: MOCK_TRAFFIC,
  unverifiedVacancies: MOCK_UNVERIFIED_VACANCIES,
  schemaPending: false,
  asOf: MOCK_AS_OF,
};

/**
 * Everything missing — proves the empty states render sensibly. `schemaPending`
 * is true because that is the honest state of the database today: neither
 * bulletin_signals nor bulletin_editor_state has been promoted or applied.
 */
export const EMPTY_PENDING_FIXTURE: BulletinBundle = {
  signals: [],
  editorStates: [],
  traffic: [],
  unverifiedVacancies: [],
  schemaPending: true,
  asOf: MOCK_AS_OF,
};
