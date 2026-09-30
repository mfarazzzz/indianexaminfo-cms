# AGENTS.md — Standing Rules

These rules are binding for every agent session on this repository. They survive
context resets. After any context reset, re-read this file and the open prompt
before acting.

- never run any CLI command that writes to the remote DB (supabase db push,
  migration up/repair, db reset --linked); migrations reach the remote only via
  MCP apply_migration after the owner's explicit approval; every applied file
  matches its remote version
- Proposed migrations are written to supabase/proposed/, never supabase/migrations/.
  A file moves into migrations/ only after the owner's approval, because a CMS push
  may apply every file in migrations/. (Confirmed 2026-09-27: the Supabase GitHub
  integration applies supabase/migrations/ to production on push-to-main — every
  file in that directory, version taken from the filename, created_by left NULL.)
- report before any destructive step, with live counts; no stale numbers
- never push; the owner pushes
- typecheck both repos and run tests after every change; local commits only
- one fact, one place; no silent fallbacks; enforce at the DB, not only in forms
- no decorative icons or emoji
- never write to the auth schema with SQL (auth.users, auth.identities, sessions,
  and friends). Test accounts are created ONLY through Supabase Auth itself
  (signup, or the admin API via an approved edge function), using addresses of
  the form qa+<purpose>@indianexaminfo.com, and deleted after the proof.
  (Why: a SQL-inserted auth.users row is unloadable by GoTrue unless every
  NOT-NULL-defaulted token column is '' and created_at is non-NULL — a silent
  500 swamp; the Auth API always gets it right.)
- never deploy anything that was not approved, including diagnostics, probes,
  and temporary helper edge functions. If a blocked proof needs a new tool, ask
  the owner first.
- the owner's saved session (.auth/cms.json) is for screenshots and read-only
  checks only. Any live write or call "as the owner" needs explicit approval in
  the prompt that uses it.
- after any context reset, re-read AGENTS.md and the open prompt before acting
