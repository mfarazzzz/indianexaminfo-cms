# Track 2 — ELMS Decision: finish it or delete it

**Status: DECIDED 2026-07-25 — Option B.** Port the single-source-of-truth date pattern into the existing `exams` editor. Retire ELMS afterwards, as a separate reviewed step.

## Decision and rationale (performance / security / UX)

### UX — decisive for B
The legacy editor works, is linked from the sidebar and dashboard, and editors used it yesterday. The ELMS workspace renders exactly one module (General), cannot reach Timeline, and cannot create an entity at all. Option A delivers zero UX improvement until the template layer, snapshot generation, and 19 unvalidated module editors are all finished. Option B fixes the duplication editors actually face, in the screen they actually use.

### Performance — favours B
| | files | lines |
|---|---|---|
| ELMS workspace (`components/workspace`) | 37 | 3,382 |
| ELMS entity-editor (`components/entity-editor`) | 32 | 3,624 |
| ELMS services (`services/entity`) | 29 | 3,663 |
| **ELMS total** | **98** | **10,669** |
| legacy exam editor (`pages/exams`) | 2 | 993 |

Plus 22 `entity*` tables. Load path per editor open: ELMS reads `entity` + `entity_snapshot` + timeline + vacancy, then a satellite query per module; the legacy editor reads one `exams` row. Option B removes ~10.7k lines and 22 tables from the maintained surface rather than adding a template layer on top of it.

### Security — favours B on surface area, with one thing worth porting
All relevant tables have RLS enabled, so this is not a "one is unprotected" comparison. It is about surface:

- Retiring ELMS removes 22 tables and their 40+ policies, plus advisor-flagged permissive policies: `entity_activity_log` INSERT and `entity_migration_log_preview` INSERT are `WITH CHECK (true)` for `authenticated`, and `conducting_body` INSERT/UPDATE are always-true.
- It also removes `SECURITY DEFINER` functions exposed over RPC to `authenticated`: `can_write_entity`, `can_publish_entity`, `elms_audit_trigger_fn`.
- **Counterpoint worth carrying forward:** ELMS's permission model (`can_write_entity` / `can_publish_entity` as named, testable predicates) is a better design than the legacy editor's five ad-hoc `exams` policies. Option B should port that idea to `exams` rather than discard it.

### What Option B concedes
The ELMS schema work is real: `entity_timeline_event` with Date_Type_Enum, the `conducting_body` parent/child hierarchy, and the satellite tables are sound designs. Option B discards them. That is accepted because the missing piece is not schema — it is the template layer everything is conditioned on, plus validation of 19 editors that have never rendered against real data.

### Sequencing (retirement is NOT part of the first step)
1. Port the pattern into `exams` — one editable surface per date, read-only chips elsewhere. Non-destructive, no DDL.
2. Verify by screenshot on the real `/exams/new` flow (the acceptance criterion already in `requirements.md`).
3. Only then propose ELMS retirement as a separate reviewed change: drop code first, tables later, backups before either. No table is dropped as part of step 1.

---

**Evidence gathering (below) was complete before the decision.**

**Naming note:** "Option A / Option B" in this document refers to the Track 2 question only (finish ELMS vs delete ELMS). It is a different axis from T3-1's Option A/B/C in `ARCHITECTURE_AUDIT_REPORT.md` (entity canonical / entity syncs to exams / parallel). Do not conflate them.

- **Option A — Finish ELMS.** Build the missing template layer, make the workspace usable, migrate the 127 exams into it, retire `/exams/new`.
- **Option B — Delete ELMS.** Port the single-source-of-truth date pattern into the existing `exams` editor, drop the `entity*` tables and the workspace code.

---

## Conclusive finding, 2026-07-25: the ELMS editor is not reachable by any editor, for a single traceable reason

This is not a blocked smoke test. The intended smoke test — edit a date in the Timeline module, watch a read-only chip elsewhere update — **cannot be performed by anyone using the product today**, and establishing why answered the question the smoke test was meant to answer.

### What was verified working

Task 11.3's chip integration was implemented and confirmed rendering in a browser at
`/entities/entrance-exam/605b40da-d8db-411d-a8c4-f2615407f0a8` (Common Admission Test, published):

- Eight `ReadOnlyDateChip` components render under a "Key Dates" heading, one per `STANDARD_DATE_TYPES` value, correctly labelled, all showing "Not set", each with an "Edit in Timeline →" affordance.
- Entity data loads correctly (name, slug, pillar, category, tags, workflow status).
- This required first fixing a crash: the route rendered the router's error fallback because `EditorUIProvider`, `PillarProvider`, and `TimelineDatesProvider` were mounted nowhere in the live tree. They had lived only in `EntityEditorShell`, which `EntityEditorPage` replaced with `WorkspaceProvider` + `WorkspaceShell` during "M4 Integration" without carrying the providers across. `EntityEditorShell` is now dead code — referenced only by its own file and stale comments. Providers are now mounted in `EntityEditorPage.tsx`.

### The blocking chain, traced end to end

| Step | Evidence |
|---|---|
| `lifecycle_template` = **0 rows**, `lifecycle_template_version` = **0 rows** | live query |
| → no template version can be resolved | `EntityCreationPage` requires `templates[0]` then `getActiveTemplateVersion` |
| `entity_snapshot` = **0 rows** | live query |
| → `entity.templateSnapshot` is null for every entity | `entityService.getEntityById` overlays snapshot from `entity_snapshot` |
| → `snapshot?.moduleVisibility` is undefined | `WorkspaceContext.tsx` ~line 100 |
| → `enabledModules` falls back to `[general]` only | same, comment reads *"No snapshot yet — show only general"* |
| → **all 18 non-General modules are unreachable** | `timeline`, `overview`, `eligibility`, `vacancy`, `fee`, `exam_pattern`, `selection_process`, `syllabus`, `modules`, `downloads`, `links`, `media`, `seo`, `publishing`, `relationships`, `amendments`, `health`, `verification` — all registered in `workspace/registry.ts` with working editors |
| → URL override cannot bypass it | `activeModule` requires `enabledModules.some(m => m.key === urlModule)`; unknown keys silently fall back to General |
| → **`/entities/:pillar/new` cannot create anything** | throws "No content configuration available for this domain" with zero templates |

Confirmed visually in the module navigation panel: General is the only entry.

### What this means

1. **The date single-source-of-truth mechanism has no editable surface.** The Timeline module is the only place a standard date may be edited by design. It is unreachable. The chips work and will never receive a value through the UI.
2. **The entity system has no working creation path.** Not "unexercised" — non-functional.
3. **This explains the pilot's shape without any other hypothesis.** 3 `entity` rows, last write 2026-07-12, `entity_module` = 0, `entity_timeline_event` = 5 (all `event_type = 'other'`, none standard). Consistent with a system abandoned at the point templates were needed.
4. **It corrects two earlier characterisations in this project.** "Correct code on an unused surface" was wrong (the integration was never done). "Reachable only by typing the URL" was also wrong (typing the URL produced an error page).

### Why this is the strongest data point for Option B so far

The gap between ELMS-as-designed and ELMS-as-running is not a missing integration or a stale test. It is a missing architectural layer — the template system — that everything else is conditioned on. Option A's true cost is not "migrate 127 rows and retire a screen"; it is design and build the template layer, generate snapshots for every entity, validate 19 module editors that have never rendered against real data, then migrate, then retire. Option B's cost is porting one pattern — a read-only chip reading from one authoritative store — into an editor that already works and that editors already use daily.

Counter-consideration to weigh honestly before deciding: the ELMS schema work is real and largely done (`entity_timeline_event` with Date_Type_Enum, the `conducting_body` hierarchy, satellite tables), and Option B discards it. The question is whether the unfinished template layer plus 19 unvalidated editors is cheaper to complete than to replace.

### Explicitly not done

No production writes were made to complete the smoke test. Inserting a throwaway `lifecycle_template` + version + `entity_snapshot` for one entity would have made the chip sync observable, but the answer it would have produced is already established by the evidence above, and a throwaway template risks becoming the accidental template standard. **If Track 2 concludes Option A, the minimal template insert becomes well-motivated real work and should be done then, with intent.**

---

*Evidence gathered 2026-07-25. Chip rendering confirmed by direct browser observation; all row counts and code paths confirmed by live query and file read.*
