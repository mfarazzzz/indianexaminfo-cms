/**
 * draftBackup.ts — browser-only draft backup + restore prompt (owner batch 4, CMS R2.5
 * increment 2 of 3).
 *
 * WHY. An editor writes a long notification or a syllabus block; the tab crashes, the laptop
 * sleeps, or the network drops before the autosave lands, and the work is gone — the CMS has no
 * local safety net today. This module is that net: a copy of the in-progress section written to
 * the BROWSER'S localStorage, keyed per user, entity and section, with a TTL, and a predicate
 * for the restore prompt.
 *
 * THE RULES THIS FILE IS BUILT ON (they are the reason it is a module and not three lines in a
 * component):
 *  • BROWSER ONLY. It never runs on a server, never touches Supabase, and never sends anything
 *    anywhere. `storageFor()` returns null in Node, in a frame that throws on access, and in
 *    private-mode Safari where the object exists but writing throws — every caller then degrades
 *    to "no backup", which is exactly the pre-R2.5 behaviour, never a crash.
 *  • NOTHING MAY THROW OUT OF THIS MODULE. localStorage.getItem/setItem/removeItem throw on
 *    quota (NS_ERROR_DOM_QUOTA_REACHED / QuotaExceededError), on access-denied frames, and on
 *    JSON that another tab corrupted. Every path is inside try/catch and returns a boolean or
 *    null, because a backup that can break the editor is worse than no backup.
 *  • IT IS A DRAFT, NOT A RECORD. It never feeds the save path or the dirty registry's truth;
 *    it only offers to put text back in the box. The restore prompt says so.
 *  • IT EXPIRES. A stale backup resurrecting last month's half-edited notice is a data-quality
 *    bug, so the TTL is enforced on READ (not by trusting a sweeper) and expired entries are
 *    dropped when the list is read.
 *  • PER USER. The key carries the signed-in user id, so a shared front-desk browser does not
 *    offer one editor the draft another typed. No credential, token or session material is ever
 *    written — only the section's own field values.
 *
 * INERT BY DESIGN, like editorDirty.ts: nothing imports it yet (owner's batch-4 rule — R2.5
 * beyond the three increments waits for "R2.5 APPROVED"). The wiring is a component calling
 * saveDraftBackup on change and askRestore on mount.
 */

const STORAGE_PREFIX = "cms-draft-v1";

/** 24h: long enough to survive a crash and a night, short enough to never be a surprise. */
export const DEFAULT_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export interface DraftEnvelope<T = unknown> {
  /** The full key, stored inside the value too so a read can verify what it found. */
  key: string;
  savedAt: number;
  ttlMs: number;
  /** The draft itself — whatever shape the section's form values have. */
  value: T;
}

export interface DraftOptions {
  /** Injectable clock, so the TTL is testable without waiting. */
  now?: () => number;
  ttlMs?: number;
  /** The signed-in user id. Without it the key is scoped to entity+section only. */
  userId?: string | null;
}

/**
 * The storage object, or null when it is unavailable. Access itself can throw (some privacy
 * settings deny the getter), so even the lookup is inside try/catch.
 */
export function storageFor(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const s = window.localStorage;
    if (!s) return null;
    return s;
  } catch {
    return null;   // access denied — no backup, no error, editor keeps working
  }
}

/**
 * draftKey — `cms-draft-v1:<user>:<entity>:<section>`.
 * Each part is encoded so an id containing ":" cannot collide with another triple
 * (entity "a:b" + section "c" must not equal entity "a" + section "b:c").
 */
export function draftKey(entity: string, section: string, userId?: string | null): string {
  const part = (v: string) => encodeURIComponent(v);
  return [STORAGE_PREFIX, userId ? part(userId) : "-", part(entity), part(section)].join(":");
}

/** True when the envelope is still a draft worth showing. */
export function isFresh(envelope: DraftEnvelope, now: number): boolean {
  if (!Number.isFinite(envelope.savedAt)) return false;
  if (envelope.savedAt > now) return false;                    // clock skew or a tampered value
  const ttl = Number.isFinite(envelope.ttlMs) && envelope.ttlMs > 0 ? envelope.ttlMs : DEFAULT_DRAFT_TTL_MS;
  return now - envelope.savedAt <= ttl;
}

/**
 * saveDraftBackup — returns true when the draft is durably in storage, false in every other
 * case (no storage, quota full, unserialisable value). Callers MUST NOT assume a false means
 * the user's work is lost in the DB sense — it means only "no extra safety net this time".
 */
export function saveDraftBackup<T>(
  entity: string,
  section: string,
  value: T,
  opts: DraftOptions = {},
): boolean {
  if (!entity || !section) return false;
  const store = storageFor();
  if (!store) return false;
  const now = (opts.now ?? (() => Date.now()))();
  const key = draftKey(entity, section, opts.userId);
  try {
    const envelope: DraftEnvelope<T> = {
      key,
      savedAt: now,
      ttlMs: opts.ttlMs ?? DEFAULT_DRAFT_TTL_MS,
      value,
    };
    store.setItem(key, JSON.stringify(envelope));
    return true;
  } catch {
    // QuotaExceededError, a circular value, a frame that denies writes. Never propagate:
    // the editor's own save path must not be able to fail because of the backup.
    return false;
  }
}

/**
 * loadDraftBackup — null unless a fresh, parseable envelope for exactly this triple exists.
 * An expired or corrupt entry is REMOVED on sight, so a broken value cannot sit in storage
 * forever being re-parsed on every mount.
 */
export function loadDraftBackup<T = unknown>(
  entity: string,
  section: string,
  opts: DraftOptions = {},
): DraftEnvelope<T> | null {
  if (!entity || !section) return null;
  const store = storageFor();
  if (!store) return null;
  const key = draftKey(entity, section, opts.userId);
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    // Trust nothing about what was in there: the stored key must match the key we asked for.
    if (!parsed || typeof parsed !== "object" || parsed.key !== key) {
      store.removeItem(key);
      return null;
    }
    const now = (opts.now ?? (() => Date.now()))();
    if (!isFresh(parsed, now)) {
      store.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;      // unreadable/corrupt — treat as no draft, never throw
  }
}

/** clearDraftBackup — idempotent, and never throws when there is nothing to clear. */
export function clearDraftBackup(entity: string, section: string, opts: DraftOptions = {}): void {
  const store = storageFor();
  if (!store) return;
  try {
    store.removeItem(draftKey(entity, section, opts.userId));
  } catch {
    /* nothing to do — a backup we cannot remove is still not going to break anything */
  }
}

/**
 * Every draft key this module owns, newest first. Expired or corrupt entries are removed while
 * we look, which doubles as the sweeper — no background job, and no trust in a value that has
 * been sitting in someone's browser for a week.
 *
 * It reads the envelopes directly rather than calling loadDraftBackup per key: the key we are
 * holding is the authority, and re-deriving it from the decoded parts would let a value with a
 * mismatched inner key count as a valid draft.
 */
export function listDraftKeys(opts: DraftOptions = {}): string[] {
  const store = storageFor();
  if (!store) return [];
  const now = (opts.now ?? (() => Date.now()))();
  const out: { key: string; savedAt: number }[] = [];
  try {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key || !key.startsWith(`${STORAGE_PREFIX}:`)) continue;
      try {
        const raw = store.getItem(key);
        if (!raw) continue;
        const env = JSON.parse(raw) as DraftEnvelope;
        if (!env || typeof env !== "object" || env.key !== key || !isFresh(env, now)) {
          store.removeItem(key);
          continue;
        }
        out.push({ key, savedAt: env.savedAt });
      } catch {
        try { store.removeItem(key); } catch { /* a storage that denies the delete is still fine */ }
      }
    }
  } catch {
    /* a storage that changes shape under us still cannot break the caller */
  }
  return out.sort((a, b) => b.savedAt - a.savedAt).map((x) => x.key);
}

/**
 * askRestore — the only decision a component needs on mount: is there a browser draft that is
 * NEWER than what the server says the section was last saved, i.e. worth interrupting the
 * editor for? A backup older than the server's own row is not a rescue, it is a stale copy, and
 * prompting about it would invite the editor to overwrite real work with an old draft.
 */
export function askRestore<T = unknown>(
  entity: string,
  section: string,
  serverSavedAt: string | number | null | undefined,
  opts: DraftOptions = {},
): { draft: T; savedAt: number } | null {
  const envelope = loadDraftBackup<T>(entity, section, opts);
  if (!envelope) return null;
  const serverMs =
    serverSavedAt === null || serverSavedAt === undefined || serverSavedAt === ""
      ? 0
      : typeof serverSavedAt === "number" ? serverSavedAt : Date.parse(String(serverSavedAt));
  if (Number.isFinite(serverMs) && serverMs > 0 && envelope.savedAt <= serverMs) return null;
  return { draft: envelope.value, savedAt: envelope.savedAt };
}
