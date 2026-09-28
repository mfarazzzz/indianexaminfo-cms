-- ─────────────────────────────────────────────────────────────────────────────
-- N2 step 1 (Q3): traffic substrate — PROMOTED 2026-09-28T04:25:56Z (the UTC
-- time of the move into migrations/, per the promotion-time versioning rule).
-- Applies on the owner's next push.
--
-- A table of Search Console page metrics so the
-- bulletin can rank its queues by what readers actually open. Ships a table with
-- NO behaviour change; enables the monthly CSV loader (CMS Settings → SEO →
-- "Import Search Console pages CSV", gated by manage_settings).
-- Frontend-independent; no dependency on the Q1/Q2 rule changes.
--
-- RLS (per the review):
--   • read  — any editor (holder of edit_own_post OR edit_any_post). These are
--     the same permission slugs the content surfaces already gate on; we use
--     current_user_has_permission(), NEVER the JWT role claim or role names.
--   • write — only manage_settings (admin/super-admin). The CMS "Import GSC CSV"
--     upload runs as a USER, not the service role, so the writer must be a real
--     permission the uploading user holds.
--   • delete — no policy at all (deny-all). Traffic is only upserted, never
--     deleted through the API.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.page_traffic (
  url          text        NOT NULL,
  clicks       integer     NOT NULL DEFAULT 0,
  impressions  integer     NOT NULL DEFAULT 0,
  period_start date        NOT NULL,
  period_end   date        NOT NULL,
  source       text        NOT NULL DEFAULT 'search-console',
  loaded_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (url, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS page_traffic_period_idx
  ON public.page_traffic (period_end DESC);

ALTER TABLE public.page_traffic ENABLE ROW LEVEL SECURITY;

-- Read: editors (edit_own_post OR edit_any_post).
DROP POLICY IF EXISTS page_traffic_read ON public.page_traffic;
CREATE POLICY page_traffic_read ON public.page_traffic
  FOR SELECT TO authenticated
  USING (
    current_user_has_permission('edit_own_post')
    OR current_user_has_permission('edit_any_post')
  );

-- Write (insert): manage_settings only.
DROP POLICY IF EXISTS page_traffic_insert ON public.page_traffic;
CREATE POLICY page_traffic_insert ON public.page_traffic
  FOR INSERT TO authenticated
  WITH CHECK (current_user_has_permission('manage_settings'));

-- Write (update / upsert target): manage_settings only.
DROP POLICY IF EXISTS page_traffic_update ON public.page_traffic;
CREATE POLICY page_traffic_update ON public.page_traffic
  FOR UPDATE TO authenticated
  USING (current_user_has_permission('manage_settings'))
  WITH CHECK (current_user_has_permission('manage_settings'));

-- No DELETE policy -> deletes are denied to every API role by default.
