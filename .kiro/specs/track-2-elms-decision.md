# Track 2: Entity/ELMS System — Decision Pending

## Status: DEFERRED — awaiting owner decision

## Context

The Entity Lifecycle Management System (ELMS) is a CMS subsystem comprising:
- 21 database tables (3 rows total across the whole system)
- 18 service files (`src/services/entity/*`, `src/services/template/*`)
- 2 route groups (`/entities`, `/taxonomy`) — both hidden from sidebar, URL-access only
- 6 target tables that the code references but **do not exist in the database** (`entity_module_block`, `entity_event_log`, `entity_relationship`, `entity_amendment`, `entity_localization`, `entity_slug_history`)

## Current broken state

1. `entity_snapshot` exists but is always empty → WorkspaceContext shows only the General tab
2. `createEntity` inserts the entity row **before** the snapshot and SEO skeleton, so a failure between those steps leaves an orphan entity that cannot be published or properly edited
3. Taxonomy Manager references 7 tables that don't exist (`department`, `tag`, `exam_level`, `exam_mode`, `application_mode`, `category` singular, `pillar`) — the route 500s on load
4. The `increment` RPC used by taxonomy merge doesn't exist in the DB

## Options

### A) Drop entirely
- Remove the 21 tables, 18 services, 2 route groups, and the `/entities` + `/taxonomy` entries from the router
- `exams` (130 rows) remains the single entity model
- ~2,000-line code reduction; schema clarity improves immediately
- Risk: the 3 existing `entity` rows + `entity_seo` + `entity_timeline_event` + `entity_activity_log` data is lost (trivially small)

### B) Fix and keep
- Create the 6 missing tables (DDL + indexes + RLS)
- Fix `createEntity` ordering (transaction or snapshot-first)
- Add sidebar links for `/entities` and `/taxonomy`
- Seed lifecycle_template + lifecycle_template_version (at least one default)
- Create the 7 taxonomy tables the Taxonomy Manager expects
- Create the `increment` RPC
- Estimated effort: 2–3 days of focused work
- Risk: adds complexity back that must then be maintained

### C) Leave as-is (status quo)
- Dead weight but no active harm to the public site
- Ongoing confusion for anyone reading the codebase
- The 3 entity rows are functionally orphaned

## Dependencies

- **Decision 5 (cms_education_news route)** is blocked until this is resolved — if ELMS is kept, education news might move into it; if ELMS is dropped, the content model stays flat.
- CMS code cleanup (any Tier 1 dead-code pass on entity services) is blocked.

## What I need

A one-word answer: **drop**, **fix**, or **leave**.  
I will not proceed on any ELMS-related change until this is answered.
