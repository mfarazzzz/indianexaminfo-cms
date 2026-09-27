# PROGRAMME_BACKLOG.md

**Phase 0 output. Generated 2026-09-27. Every claim below was verified against the live
Supabase database, the code in both repos, or the running site. No document claim was
accepted without evidence. Report only; no code or data changed to produce this file.**

---

## Verified Backlog

| Item | Workstream | Status | Evidence | User impact | Effort | Risk | Depends on |
|---|---|---|---|---|---|---|---|
| W0(a): JobPosting/Event fixture tests | W0 | done-verified | commit 5bcb960; 19 tests, all pass | Low (internal) | — | — | — |
| W0(b): sarkari JobPosting gated to window | W0 | done-verified | commit f14c6a1; DB: 0 rows emit after gate (all 361 have null dates) | High (all 361 pages were invalid) | — | — | — |
| W0(c): nginx.conf marked as non-live | W0 | done-verified | commit 6fe8071 | Low | — | — | — |
| W0(d): apex→www 301 in hPanel | W0 | owner-action | curl apex returns 200 (no redirect yet) | Medium (duplicate host) | — | — | Owner confirms hPanel done |
| RLS on every table | A | done-verified | pg_class query: 0 tables with rls_enabled=false | Critical (base security) | — | — | — |
| Backup tables can be dropped | A | pending | 4 tables: region_seed(404), menu_items(21), uni_merge(12), admission_move(4) — all changes proven live | Low | M | Low | — |
| /api/revalidate: secret checked every call | A | done-verified | timingSafeCompare on x-revalidate-token against env.REVALIDATE_TOKEN; CORS narrow | Critical (cache integrity) | — | — | — |
| /api/search: no max input length, no rate limit | A | partial | Min 2 chars enforced; no max; no throttle; force-dynamic | Medium (DoS vector) | S | Low | — |
| No service-role key in frontend bundle | A | done-verified | grep SUPABASE_SERVICE/SERVICE_ROLE: 0 hits in frontend | Critical | — | — | — |
| admin-set-temp-password edge function: JWT+DB gate | A | done-unverified | Code checks Bearer JWT + manage_users from DB; cannot prove 403 live without non-admin test token | High (user management) | — | — | Live proof with test user |
| audit_log: zero rows, nothing writes to it | A | done-verified | count=0; no INSERT into audit_log found in either repo | Medium (operational traceability) | M | Low | Decide: wire or drop |
| CMS autosave: 2s pending window lost on hard unload | A | partial | beforeunload warns but does NOT flush; 2s debounce window exists | Medium (lost work) | S | Low | — |
| Security headers on live site | A | partial | HSTS ✓, X-Frame ✓, X-Content-Type-Options ✓, Referrer-Policy ✓, Permissions-Policy ✓; CSP only `upgrade-insecure-requests` (no script-src/style-src) | High (XSS hardening gap) | M | Low | — |
| Supabase Auth password policy | A | owner-action | Not verified; Supabase default allows 6-char | Medium | — | — | Owner (hPanel/dashboard) |
| GitHub branch protection: typecheck required | A | owner-action | Not verified from code | Medium | — | — | Owner (GitHub settings) |
| CDS duplicates: 3 records (cds, cds-exam, upsc-cds) | B | pending | DB confirmed: pillar=government-exam ×2 + entrance-exam ×1, all published | High (duplicate content + link equity) | M | Medium | taxonomy_redirects + survivor decision |
| NDA duplicates: 3 records (nda, nda-exam, upsc-nda) | B | pending | DB confirmed: same pattern | High | M | Medium | Same |
| UPSC CMS ×2 claim | B | stale-claim | DB: only 1 record (upsc-cms-examination-2026). LAUNCH_READINESS.md claim outdated | Low | — | — | — |
| UGC NET ×2 claim | B | stale-claim | DB: only nta-ugc-net exists; ugc-net slug absent | Low | — | — | — |
| AIIMS NORCET ×2 claim | B | stale-claim | DB: only 1 record (aiims-norcet-11th-nursing-officier-recruitment-2026) | Low | — | — | — |
| RPF ×2 confirmed (rpf-constable + rpf-constable-si-recruitment) | B | pending | DB: 2 published rows, same name | High | M | Medium | Same |
| ssc-constable-gd-2 named "Delhi Police Constable" | B | pending | DB: slug=ssc-constable-gd-2, name="Delhi Police Constable" — confirmed mislabel | High (misinformation on a live page) | S | Low | — |
| taxonomy_redirects: empty, ready for request-time redirects | B | done-verified | count=0; table exists | Low (infrastructure ready) | — | — | Merge items |
| 201 editions have notification_date in the DB column; frontend never reads it | B | stale-claim | Brief says 163; actual count=201. Frontend only reads notification_date from sarkari_naukri (confirmed grep). Concept correct, number wrong. | Medium (invisible data field) | M | Low | Decide: read or drop column |
| sarkari_naukri + govt-vacancy: 0 structured dates on 361 rows | B | done-verified | DB: count(notification_date)=0, count(app_start)=0, count(app_end)=0 on all 361 | High (no JobPosting eligibility; users cannot see last date) | L | Medium | Data entry workflow (bulletin) |
| Conducting body across BOTH tables: 583 distinct, 136 composite | B | done-verified | exams.conducting_body: 280 distinct, 3 composite. sarkari_naukri.organization: 312 distinct, 133 composite. Union: 583, exact overlap: 9. The 583/136 claim IS correct when scoped across both tables. | Medium (deduplication registry) | M | Low | conducting_body table (empty, ready) |
| conducting_body table: empty, exists | B | done-verified | count=0 | Low | — | — | Reference-field feature |
| ExamEditorPage reachable only from dashboard card | C | stale-claim | Routes: /exams/new and /exams/:id live; ExamsListPage navigates to /exams/:id too | Medium (confusion) | M | Low | Dashboard card decision |
| ELMS entity_* tables: 3 rows in entity, 0 in all others; CMS services fully wired | C | done-verified | DB: entity=3, entity_module=0, entity_revision=0, entity_link=0. CMS router: /entities/* registered. Frontend: 0 reads. | Low (dormant V2, not a bug) | — | — | V2 activation triggers (ROADMAP §10) |
| has_* flags: populated but read by nothing for decisions | C | done-verified | examService.mapRow populates hasAdmitCard/hasResult/etc from DB. CT_FLAGS array in app/sitemap.ts (lines 81-92) declares their names but the filter at line 148 calls contentTypeHasData(), not the booleans. No component or route reads exam.hasXxx for any gate. The flags are dead payload on the entity. | Low (remove in dead-code pass) | S | Low | — |
| pillarToUrlSegment legacy aliases: 0 DB rows match | C | done-verified | DB: no pillar='sarkari-bharti' or 'board-university'. Aliases safe to remove. | Low (code cleanliness) | S | Low | — |
| Navigation: header=static-data.ts; footer=menu_items DB | C | done-verified | HeaderWithMenu imports buildNavigationTrees from static-data; Footer imports getMenuBySlug from menuService | Medium (can drift) | M | Medium | Consolidation design |
| Footer Gov Jobs: 4/6 links go to /sarkari-naukri/exam (same page) | C | done-verified | menu_items DB: SSC/Banking/Railway/Defence all url=/sarkari-naukri/exam | High (bad UX; 4 labels, one destination) | S | Low | Update menu_items or static nav |
| redirect() inside page components | C | done-verified | sarkari-naukri/[...segments]/page.tsx:171 and editionDispatch.tsx:118 | Medium (200-streamed redirects, SEO-unfriendly) | S | Low | loading.tsx decision (J) |
| 10 orphaned CMS pages | C | pending | Not re-verified this session; requires CMS route-graph audit | Low | M | Low | — |
| Field audit: declared/stored/read for every editor field | D | partial | FIELD_RENDERER_MAP_DESIGN.md describes rule; contract.coverage.test.ts exists (9 modules checked); PHASE-3 findings: 1 baseline COMPETING_SOURCE (GDS vacancy-details.totalPosts, non-blocking) | High (editor confusion) | L | Medium | Complete audit for all modules |
| previous-papers, study-material: no module_registry entries | D | pending | content_types exist in DB; module_registry absent for these slugs | High (nobody can enter content) | M | Low | — |
| Date rows: save filters dropping date-less rows | D | pending | Not verified this session; check CMS save logic | Medium | S | Low | — |
| AI Fill: preview-before-overwrite rule | D | pending | Not verified | Medium | M | Low | — |
| News linking: content_post_exams many-to-many | D | pending | Designed (track-2-elms-decision.md); not built | Medium | L | Low | — |
| Dashboard: work-not-inventory | E | pending | Not verified | Medium | M | Low | — |
| Review queue for content-intern role | E | pending | Role exists; no queue mechanism | High (blocks intern workflow) | M | Medium | — |
| Measure: tabs/fields to create one complete exam | E | pending | Not counted | Medium | S | Low | — |
| Bulletin Layer 1: design | F | pending | Roles, assignee, updated_by, region all exist; contentTypeHasData gate live | High (intern's daily queue) | L | Medium | B (data completeness signals) |
| Bulletin: recency window essential (avoid false positives) | F | pending | LAUNCH_READINESS: ~348 C-tier + 4 D-hollow out of 402; current: 386/396 have <3 FAQs, 314/396 have <2 dates — same conclusion | High (signal-to-noise) | M | Low | — |
| Page-weight budget on mobile profile | G | pending | Not measured | High (tier-2/3 users) | M | Low | — |
| Trust signals: official source link, no fake urgency | G | pending | Official website link exists in entity pages; no systematic audit | High (credibility) | M | Low | — |
| Hindi: first measured step | G | pending | Not designed | Medium | L | Low | Content strategy |
| JobPosting exam builder gated | H | done-verified | Commit 8019757 (prev session) + 5bcb960 (tests). 0 emit today (no open exams). | High | — | — | — |
| Thin content: 386/396 exams have <3 FAQs; 314/396 have <2 dates | H | pending | Verified. Propose completeness threshold below which sitemap excludes and page is noindex. | Critical (E-E-A-T site-wide signal) | L | Medium | F (bulletin drives completion) |
| FAQ schema: Google restricted to authoritative govt/health sites | H | done-verified | FAQ schema still emitted on exam pages. Google deprecation (Aug 2023) means it has no rich-result value. Not harmful; just no benefit. Do NOT invest in more FAQ entries for SEO. | Low (no negative effect) | — | — | — |
| Sitemap lastmod: uses updatedAt, not deploy time | H | pending | Not verified this session | Medium | S | Low | — |
| News sitemap freshness | H | pending | Not verified | Medium | S | Low | — |
| Canonical host: apex still 200 (no redirect yet) | H | owner-action | curl confirmed; hPanel 301 being set | High (duplicate indexing) | — | — | W0(d) |
| Internal linking: related exams, same body, same state | H | pending | EntityDetailPage shows related exams by pillar; conducting-body link absent | Medium | M | Low | conducting_body registry |
| Google Indexing API for JobPosting pages | I | pending | Not designed | High (speed to crawl for vacancies) | M | Medium | H (JobPosting gate live) |
| State pages: read both tables, strong for regional queries | I | pending | State pages exist (grep confirmed); Search Console shows regional dominance | High | M | Low | B (data completeness per state) |
| Google Discover: 12 published blog posts, 0 have featured images | I | done-verified | DB: count=12, no_featured_image=12 | Medium (Discover eligibility requires large image) | S | Low | Content (add images) |
| Admission-intent pages (direct admission, MBA without CAT) | I | pending | Content strategy; not built | High (revenue intent) | L | Low | G (UX design) |
| Core Web Vitals: not measured | J | pending | No CWV measurement found | High (ranking signal) | M | Low | — |
| loading.tsx causes page-level redirect() to stream 200 | J | done-verified | Documented in session context; root cause of 200-redirect behaviour | High (SEO + UX) | M | Medium | — |
| Homepage: 5 parallel queries in one Promise.all | J | done-verified | app/page.tsx lines 51-57 confirmed: getExamsByPillar×2 + getAllExams + getDeadlineBands + getTodayIST | Medium | S | Low | — |
| Derived-status VIEW scan cost at scale | J | pending | Not benchmarked; projected to cross 500ms at ~4000 records (396 today, not at risk) | Low (not near limit) | M | Low | — |
| .md file sprawl: 68 files, many stale | K | pending | Glob returned 68 files; stale-claim markers above confirm several numbers are wrong | Medium (misleads readers) | M | Low | All workstreams stable |

---

## My Own Suggestions

These emerged from the investigation and are not simply re-stated claims from the documents.

| Suggestion | Evidence | Impact | Effort |
|---|---|---|---|
| **CSP on live site is effectively absent** | The only CSP directive is `upgrade-insecure-requests`. No `script-src`, `style-src`, `img-src`. A XSS payload is unrestricted beyond the X-Frame-Options. This is the biggest remaining security gap after RLS is already in place. | Critical | M |
| **Fix footer Government Jobs column first** | 4/6 links (SSC, Banking, Railway, Defence) go to the same page. This is visible site-wide on every page and immediately misleading. Fix: link each to the actual filtered sarkari-naukri category URL (e.g., `/sarkari-naukri/ssc`). DB-only change; no code needed. | High | S |
| **Propose dropping audit_log now** | It has zero rows, no writer, and was deferred as V2-only. The V2 lifecycle/notifications work that would need it has no schedule. Carrying an unused table with a misleading name (implies audit trail exists) is worse than dropping it and re-adding when the actual need arrives. | Low | S |
| **Govt-vacancy exams also need structured dates entered** | The JobPosting gate for exams (pillar=government-exam) works correctly and emits 0 today because no exam is currently open. But the deeper issue: the application window data lives in `exam_editions.important_dates` (typed rows) — the same resolver the exam JobPosting uses. 100 govt-vacancy exams need dates to be entered before the gate produces anything. This is the bulletin's highest-priority use case. | High | L |
| **The 12 blog posts are too few for Google Discover** | Discover requires consistent publishing volume, not just large images. At 12 posts the Discover optimization effort is premature. Focus on content volume first (bulletin-driven editorial workflow), then revisit images. | Medium | — |
| **ExamEditorPage is reachable from ExamsListPage too** | The claim that it's "only reachable from the dashboard card" is stale — there's a second entry point. The duplication question is still valid (all other pillars use EntranceExamEditorPage) but needs a fresh reachability audit before deciding to retire it. | Medium | M |
| **Sarkari_naukri structured-date data gap is the root blocker for multiple workstreams** | All 361 vacancy records have null application_start_date, application_end_date, and notification_date. This single data gap simultaneously: (a) prevents JobPosting emission; (b) makes the sarkari_naukri status column the only signal (and it's 98.6% wrong); (c) makes "last date to apply" invisible on every vacancy page; (d) makes the "speed to publish with Indexing API" traffic plan impossible. Priority: get dates entered via bulletin + CMS editor, then the other gates unlock naturally. | Critical | L |
| **No search input length cap** | `/api/search` accepts any-length `q`. A 10,000-character query hits Supabase with an unbounded ILIKE. Add a max-length guard (e.g., 200 chars) as a cheap defense-in-depth measure. | Low | S |
| **`upgrade-insecure-requests` is the wrong directive for a fully-HTTPS site** | If every resource is already HTTPS, this directive does nothing. It should be replaced with a real CSP or the directive should be evaluated against actual mixed-content reports. | Medium | M |

---

## Proposed Order of Workstreams

| Rank | Workstream | Reasoning |
|---|---|---|
| 1 | **C — Dead Code and Redundancy** | Smallest, lowest-risk. Removes false premises that mislead every subsequent decision. Removes ExamEditorPage, ELMS confusion, legacy pillar aliases, and the navigation-source confusion. Every other workstream is easier on a cleaner base. |
| 2 | **A — Security** | Close the CSP gap, the search input gap, and decide the backup-table drops. These are concrete, low-effort items. The high-severity items (RLS, no service-role in bundle, revalidate secret) are already verified safe. |
| 3 | **B — Data Integrity** | The duplicate exams, wrong name, and structured-date gaps are the foundation for all SEO and traffic work. Fix duplicates before Google discovers them independently. The ssc-constable-gd-2 mislabel is a one-line data fix that removes an active misinformation risk. |
| 4 | **H — SEO** | With B's data correct, commit the thin-content completeness threshold (noindex below threshold, exclude from sitemap). This is the highest-leverage SEO decision: 314 records with <2 dates should not be in the sitemap today. FAQ schema is already live and harmless; no further FAQ investment needed. |
| 5 | **F — The Bulletin** | The bulletin drives data completion — which is the single blocker for both SEO eligibility AND JobPosting eligibility. Design it now; it's the intern's daily work queue. Depends on B (signals need real dates to be meaningful). |
| 6 | **D+E — CMS Editor and UI** | The bulletin's workflow (F) shapes what the editor needs. The field audit (D) should run after the thin-content threshold (H) so the editor prioritises completeness-driving fields. Module registry entries for previous-papers/study-material are prerequisite content gates. |
| 7 | **G — Frontend UX** | The page-weight budget and trust signals matter most once B and H have put good data on well-structured pages. Design Hindi first-step after the data model is stable. |
| 8 | **I — Traffic** | The Indexing API, state-page optimization, and admission-intent pages are all high-value but depend on B (data completeness), H (correct structured data), and F (speed-to-publish workflow). Once the foundation is right, these compound. |
| 9 | **J — Performance** | Measure Core Web Vitals now (baseline), but optimise after G lands — a page redesign can change performance dramatically. The loading.tsx/redirect-200 problem and the derived-status VIEW scan are both known and not critical at current scale (396 records, far from the 4,000 projected limit). |
| 10 | **K — Repo and Docs** | Do last, after all other workstreams are stable. Consolidate the 68 .md files then, so the final state is documented accurately. |

**Key reasoning:** This is a dependency order, not an urgency order. The sarkari structured-date gap (B) and thin-content sitemap decision (H) have the highest compound impact but depend on the bulletin (F), which depends on the data model being clean (B→C→A order). The path to "30 open JobPosting pages correctly emitting" runs through C→B→F→H, not through direct SEO or traffic work.

---

## Document Inventory

68 .md files found. Status reflects whether the specific claims in each have been checked against current code/DB.

### Workspace root

| File | Status | Notes |
|---|---|---|
| PARKED_WORK.md | current | Priorities list and correct-status annotations; still accurate |
| REBUILD_PLAN.md | stale-claim | Numbers and status from earlier audit cycles; superseded by ROADMAP |
| ROADMAP_EXECUTION_PLAN.md | current (conducting-body 583/136 confirmed across both tables) | Architecture decisions current; notification_date count (163) wrong (actual: 201); sarkari_naukri fold status still pending (confirmed 0 dates); GDS analysis current |
| LAUNCH_READINESS.md | partly stale | Content tiers from 2026-08-30; totals (402 exams, 361 sarkari) close to current (396, 361); 202 stale-status records fixed by derived VIEW; "0 dates in sarkari" still true |
| EXHAUSTIVE_PLATFORM_AUDIT.md | stale-claim | Pre-VIEW status findings now superseded; conducting-body numbers wrong |
| PLATFORM_AUDIT_REPORT.md | stale-claim | 191-line audit; security headers claim (70) says "CSP set" — CSP is minimal only; other items partially verified |
| CONSISTENCY_AUDIT.md | stale-claim | Claims about navigation and content types; some items now done since the audit |
| PHANTOM_FIELD_SURVEY.md | partly stale | Field-declared-not-read analysis; the field-renderer CI test (contract.coverage) has since formalized this; 1 baseline finding remains |
| NORMALIZATION_AUDIT.md | stale-claim | 974-line deep audit from an earlier state; numbers changed |
| SELECTION_MODEL_AND_ARCHITECTURE.md | current | Architecture design document; still describes the model |
| SELECTION_TYPE_DESIGN.md | current | Design spec; still applies |
| MOBILE_AND_GOOGLE_POLICY_AUDIT.md | partly stale | Policy claims current; site-specific findings from earlier state |
| ONE_PAGE_ONE_ORDER_DESIGN.md | current | Design spec for page ordering |
| CANONICAL_CONTRACT_CI_SPEC.md | current | CI spec for the contract tests |
| CANONICAL_DATA_MIGRATION_MATRIX.md | current | Migration matrix; still accurate |
| CANONICAL_DATA_OWNERSHIP_AUDIT.md | current | Ownership map |
| CANONICAL_MODULE_CONTRACT.md | current | Module contract |
| MODULES_TAB_TRUTH_DESIGN.md | current | Modules tab design |
| CMS_REDESIGN.md | current | High-level redesign brief |
| CMS_REFACTORS_AND_STATUS_DESIGN.md | current | Status/refactor design |
| PRODUCTION_VERIFICATION_CHECKLIST.md | partly stale | Some items now verified since this checklist was written |
| STATIC_PRODUCTION_AUDIT.md | current | Static-site audit findings |
| STEP2B_EDITOR_DESIGN.md | current | Editor design |
| STEP2_REGISTRY_DESIGN.md | current | Registry design |
| AUDIT_REPORT.md | stale-claim | From earlier in project life; many findings addressed |
| DATABASE_AUDIT_REPORT.md | stale-claim | Numbers changed |

### indianexaminfo-cms/

| File | Status |
|---|---|
| README.md | current |
| ARCHITECTURE.md | current |
| ARCHITECTURE_AUDIT_REPORT.md | stale-claim |
| CMS_REDESIGN_SESSION_LOG.md | current (session log; not forward-looking claims) |
| CMS_SINGLE_SOURCE_OF_TRUTH.md | current |
| DATABASE_AUDIT_REPORT.md | stale-claim |
| PRODUCTION_CERTIFICATION.md | partly stale |
| PRODUCTION_READINESS_REPORT.md | partly stale |
| SECURITY_FIXES_2026-07-25.md | current (historical; both findings confirmed fixed in code) |
| SEO_KEYWORD_MATRIX_1000.md | current (keyword matrix reference) |
| UNIVERSITY_BOARD_AUDIT_REPORT.md | partly stale |
| docs/ (13 files) | current — standard documentation; no stale-claim risk; they describe how things work, not status |
| qa/ (6 files) | current — process docs |

### indianexaminfo-frontend/

| File | Status |
|---|---|
| README.md | current |
| DEPLOY.md | current |
| FRONTEND_AUDIT.md | partly stale |

---

**End of Phase 0. Awaiting owner approval of workstream order before any workstream begins.**
