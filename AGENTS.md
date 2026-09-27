# AGENTS.md — Standing Rules

These rules are binding for every agent session on this repository. They survive
context resets. After any context reset, re-read this file and the open prompt
before acting.

- never run any CLI command that writes to the remote DB (supabase db push,
  migration up/repair, db reset --linked); migrations reach the remote only via
  MCP apply_migration after the owner's explicit approval; every applied file
  matches its remote version
- report before any destructive step, with live counts; no stale numbers
- never push; the owner pushes
- typecheck both repos and run tests after every change; local commits only
- one fact, one place; no silent fallbacks; enforce at the DB, not only in forms
- no decorative icons or emoji
- after any context reset, re-read AGENTS.md and the open prompt before acting
