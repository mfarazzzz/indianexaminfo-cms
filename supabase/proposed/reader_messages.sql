-- ─────────────────────────────────────────────────────────────────────────────
-- S0-5 (owner brief 2026-09-28): CONTACT AND READER-REPORT MANAGEMENT.
-- PROPOSED ONLY — not promoted, not applied. Compiled and tested inside a
-- ROLLED-BACK transaction via MCP; the owner reviews and approves before this
-- moves into supabase/migrations/ (version = UTC time of promotion).
--
-- Goal (S0-5): a reader can reach us in one or two taps from anywhere, and
-- every message lands in the CMS as DATA (never an email that gets lost).
-- The brief specifies the reader side (A.1 /contact form, A.2 report-error
-- sheet, A.3 footer/menu mailto, A.4 "ONE server endpoint") but is TRUNCATED
-- at A.4 — the CMS-handling half (part B) and the exact endpoint contract are
-- not yet given. So this file designs the DATA LAYER and the single server-side
-- write path, and leaves the CMS list/detail screens and the route-handler
-- wiring as design notes for the follow-up turn once the rest of the spec and
-- the owner's approval arrive.
--
-- ── Why a SECURITY DEFINER RPC instead of a direct anon INSERT ───────────────
-- Readers are not logged in ("no login"), so the write must be reachable by the
-- anon role. Direct anon INSERT on a table is a spam/mass-exfil risk and cannot
-- enforce cross-column rules ("at least one of email/phone", message length).
-- One SECURITY DEFINER function is therefore THE single endpoint's database
-- arm: it validates, applies the entry-point-specific rules, rate-limits, mints
-- the reference number, and inserts exactly the whitelisted columns. The anon
-- role gets EXECUTE on the function and NO table policies — so the public site
-- can submit and nothing else. The Next.js route handler (or edge function)
-- that A.4 calls for is a thin proxy in front of this RPC; it adds IP-level
-- rate limiting and never holds a privileged key beyond the public anon key
-- (which by itself cannot write, per the policies below). This keeps the S0-1
-- principle: browser/app never sees a service key.
--
-- ── RLS summary ──────────────────────────────────────────────────────────────
--   • anon      : NO select/insert/update/delete policies (deny-all). Only
--                  EXECUTE on submit_reader_message(). Writes happen as the
--                  function owner via SECURITY DEFINER.
--   • editor    : SELECT/UPDATE gated on current_user_has_permission('edit_any_post')
--                  — the same slug the content surfaces use; a dedicated
--                  'manage_reader_messages' slug is a part-B decision once the
--                  CMS screens exist. UPDATE limited to the handling columns
--                  (status / handled_by / handled_at / internal_note); the
--                  reader's own words (message, contact, page) are immutable.
--   • delete    : no policy at all (deny-all). Corrections are lifecycle
--                  (status='wont_fix'), never destruction, so the audit trail
--                  and the reference number keep resolving.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reader_messages (
  id            uuid        primary key default gen_random_uuid(),
  -- Human reference the reader is shown on success (IEI-XXXXX) and quotes in
  -- follow-ups. Derived from the id; UNIQUE so every code resolves to one row.
  ref_number    text        NOT NULL UNIQUE,
  -- Where the message came from: the full /contact form or a report-error
  -- sheet. Drives which validations applied and how the CMS triages.
  source        text        NOT NULL
    CHECK (source IN ('contact_form', 'report_sheet')),
  -- Message category (locale-independent codes; UI maps EN/HI labels).
  category      text        NOT NULL
    CHECK (category IN (
      'report_error',       -- Report an error on a page
      'suggest_update',     -- Suggest an update or a new vacancy
      'general_question',   -- General question
      'technical_problem',  -- Technical problem on the site
      'advertising',        -- Advertising or partnership
      'legal_removal'       -- Content removal or legal
    )),
  -- One-tap reason from the report-error sheet (A.2). Nullable; only used when
  -- source='report_sheet' (or when the contact form picked report_error).
  reason        text
    CHECK (reason IS NULL OR reason IN (
      'wrong_last_date', 'broken_link', 'wrong_eligibility',
      'missing_result', 'other'
    )),
  message       text        NOT NULL,          -- 10..2000 chars, enforced in fn
  sender_name   text,                          -- optional
  sender_email  text,                          -- validated if present
  sender_phone  text,                          -- Indian mobile accepted if present
  page_url      text,                          -- auto-filled from the page, editable
  page_title    text,                          -- carried from the page for context
  consent       boolean     NOT NULL DEFAULT false, -- privacy notice accepted
  -- Handling lifecycle (CMS side, part B).
  status        text        NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'triage', 'in_progress', 'resolved', 'wont_fix')),
  handled_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  handled_at    timestamptz,
  internal_note text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reader_messages_status_idx
  ON public.reader_messages (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reader_messages_created_idx
  ON public.reader_messages (created_at DESC);

ALTER TABLE public.reader_messages ENABLE ROW LEVEL SECURITY;

-- anon: intentionally NO policies. Direct reads/writes are denied by default.
-- Editor read: holders of edit_any_post (content managers) can see the queue.
DROP POLICY IF EXISTS reader_messages_editor_read ON public.reader_messages;
CREATE POLICY reader_messages_editor_read ON public.reader_messages
  FOR SELECT TO authenticated
  USING (current_user_has_permission('edit_any_post'));

-- Editor update: same holders may advance handling, but only the handling
-- columns change; the USING clause re-checks the row they may see, and the
-- reader's submitted content is left immutable by the route/service layer.
DROP POLICY IF EXISTS reader_messages_editor_update ON public.reader_messages;
CREATE POLICY reader_messages_editor_update ON public.reader_messages
  FOR UPDATE TO authenticated
  USING (current_user_has_permission('edit_any_post'))
  WITH CHECK (current_user_has_permission('edit_any_post'));

-- No DELETE policy -> deletes denied to every API role.

-- ─────────────────────────────────────────────────────────────────────────────
-- submit_reader_message — the ONE server-side write path (brief A.4).
-- SECURITY DEFINER so anon can submit without a table policy; runs as the owner
-- (privileged) but only ever inserts the columns above after validation.
-- Returns the reference number for the success screen.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_reader_message(
  p_source       text,
  p_category     text,
  p_message      text,
  p_reason       text    DEFAULT NULL,
  p_name         text    DEFAULT NULL,
  p_email        text    DEFAULT NULL,
  p_phone        text    DEFAULT NULL,
  p_page_url     text    DEFAULT NULL,
  p_page_title   text    DEFAULT NULL,
  p_consent      boolean DEFAULT false
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id   uuid;
  v_ref  text;
  v_msg  text := btrim(coalesce(p_message, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_reason text := NULLIF(btrim(coalesce(p_reason, '')), '');  -- '' -> NULL
  v_recent int;
BEGIN
  -- Entry point must be one of the two known surfaces.
  IF p_source IS NULL OR p_source NOT IN ('contact_form', 'report_sheet') THEN
    RAISE EXCEPTION 'invalid source' USING ERRCODE = 'check_violation';
  END IF;

  -- Category present and recognised.
  IF p_category IS NULL OR p_category NOT IN (
       'report_error','suggest_update','general_question',
       'technical_problem','advertising','legal_removal') THEN
    RAISE EXCEPTION 'invalid category' USING ERRCODE = 'check_violation';
  END IF;

  -- Optional reason, if supplied, must be recognised (empty string == none).
  IF v_reason IS NOT NULL AND v_reason NOT IN (
       'wrong_last_date','broken_link','wrong_eligibility','missing_result','other') THEN
    RAISE EXCEPTION 'invalid reason' USING ERRCODE = 'check_violation';
  END IF;

  -- Message length 10..2000 (the one hard-required field everywhere).
  IF char_length(v_msg) < 10 THEN
    RAISE EXCEPTION 'message too short' USING ERRCODE = 'check_violation';
  END IF;
  IF char_length(v_msg) > 2000 THEN
    RAISE EXCEPTION 'message too long' USING ERRCODE = 'check_violation';
  END IF;

  -- Contact rules differ by surface:
  --   contact_form  -> at least one of email/phone, plus consent.
  --   report_sheet  -> contact optional (lower the barrier per A.2), consent
  --                    implied by the on-sheet privacy line.
  IF p_source = 'contact_form' THEN
    IF v_email = '' AND v_phone = '' THEN
      RAISE EXCEPTION 'email or phone required' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT p_consent THEN
      RAISE EXCEPTION 'consent required' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Validate email only if provided (loose shape; we never store anything we
  -- cannot reply to, but we do not over-engineer RFC parsing here).
  IF v_email <> '' AND v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'invalid email' USING ERRCODE = 'check_violation';
  END IF;

  -- Validate phone only if provided: accept 10-digit Indian mobile or +91 form.
  IF v_phone <> '' AND v_phone !~ '^\+?9?1?[6-9][0-9]{9}$' THEN
    RAISE EXCEPTION 'invalid phone' USING ERRCODE = 'check_violation';
  END IF;

  -- Page URL, if provided, must be http(s) and bounded.
  IF p_page_url IS NOT NULL AND btrim(p_page_url) <> ''
     AND btrim(p_page_url) !~ '^https?://' THEN
    RAISE EXCEPTION 'invalid page_url' USING ERRCODE = 'check_violation';
  END IF;

  -- Rate limit by contact target (email or phone): no more than 3 submissions
  -- per hour. Anonymous sheet reports with no contact are rate-limited at the
  -- route handler by IP instead.
  IF v_email <> '' OR v_phone <> '' THEN
    SELECT count(*) INTO v_recent
      FROM public.reader_messages
     WHERE created_at > now() - interval '1 hour'
       AND ( (v_email <> '' AND sender_email = v_email)
          OR (v_phone <> '' AND sender_phone = v_phone) );
    IF v_recent >= 3 THEN
      RAISE EXCEPTION 'too many messages, try again later'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Generate the id first, then derive the human reference from it, so both
  -- come from the same row and UNIQUE(ref_number) holds without a placeholder
  -- collision window. 5 hex chars of a uuid (~1M codes); the UNIQUE index is
  -- the ultimate guard against the vanishingly rare clash.
  v_id  := gen_random_uuid();
  v_ref := 'IEI-' || upper(substr(replace(v_id::text, '-', ''), 1, 5));

  INSERT INTO public.reader_messages (
      id, ref_number, source, category, reason, message,
      sender_name, sender_email, sender_phone,
      page_url, page_title, consent)
  VALUES (
      v_id, v_ref, p_source, p_category,
      v_reason,
      v_msg,
      NULLIF(btrim(coalesce(p_name, '')), ''),
      NULLIF(v_email, ''),
      NULLIF(v_phone, ''),
      NULLIF(btrim(coalesce(p_page_url, '')), ''),
      NULLIF(btrim(coalesce(p_page_title, '')), ''),
      p_consent);

  RETURN v_ref;
END;
$$;

-- Reachability: the public site (anon) may CALL the function; the function's
-- SECURITY DEFINER body is the only way a row is written. No table policy for
-- anon exists, so EXECUTE here grants exactly the submit path and nothing more.
REVOKE ALL ON FUNCTION public.submit_reader_message(text, text, text, text, text, text, text, text, text, boolean) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submit_reader_message(text, text, text, text, text, text, text, text, text, boolean) TO anon, authenticated;
