-- ══════════════════════════════════════════════════════════════════════════════
-- Option D / D-P1 — content_posts becomes THE exam update item. ADDITIVE ONLY.
-- Applied to the remote DB via MCP apply_migration at version 20261013125113;
-- this file carries that SAME version so the Supabase GitHub integration sees it
-- already in schema_migrations and will NOT re-apply it on push-to-main.
--
-- Live counts re-verified immediately before applying (2026-10-13, matched header):
--   content_posts total = 112; status published = 112; non-published = 0;
--   exam_id NOT NULL = 0; exam_edition_id NOT NULL = 0; is_breaking = 33.
--   => every new column starts NULL/defaulted; 0 rows affected.
--
-- Owner decisions (Option D): kind ∈ {provisional,final,revised,corrigendum,withdrawn};
--   NO new post_status value (withdrawn keeps status='published', renders in a history
--   block; full hiding = 'unpublished'); NO event_date column; links/files stay JSONB
--   (quick_links/attachment_urls). RLS is UNCHANGED — content_posts already has
--   staff_read_all_content USING (auth.uid() IS NOT NULL) beside public_read_content
--   USING (status='published'), so draft insert/update...select().single() is safe.
--   expires_at is filtered in QUERIES, not RLS (an expired item is stale, not secret).
--
-- Audit (verified): mappers that read content_posts pick named fields, NOT `...row`
--   (frontend services/contentPostService.ts mapRow; cms src/services/contentService.ts
--   mapRow), so these trailing columns neither break nor leak. INSERT INTO content_posts
--   exists only in already-applied 20260730164022 / 20260730164054 with explicit column
--   lists — trailing columns are unaffected.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.content_posts
  ADD COLUMN IF NOT EXISTS kind          text NULL,          -- provisional|final|revised|corrigendum|withdrawn
  ADD COLUMN IF NOT EXISTS supersedes_id uuid NULL REFERENCES public.content_posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expires_at    timestamptz NULL,
  ADD COLUMN IF NOT EXISTS display_order int      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verified_by   uuid      NULL;      -- auth.users id; no FK by design

-- kind vocabulary (CHECK), re-added idempotently.
ALTER TABLE public.content_posts DROP CONSTRAINT IF EXISTS content_posts_kind_check;
ALTER TABLE public.content_posts
  ADD CONSTRAINT content_posts_kind_check
  CHECK (kind IS NULL OR kind IN ('provisional','final','revised','corrigendum','withdrawn'));

-- Indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS content_posts_exam_ct_status_idx
  ON public.content_posts (exam_id, exam_edition_id, content_type, status);
CREATE INDEX IF NOT EXISTS content_posts_ct_status_pub_idx
  ON public.content_posts (content_type, status, published_at DESC);
CREATE INDEX IF NOT EXISTS content_posts_expires_idx
  ON public.content_posts (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS content_posts_supersedes_idx
  ON public.content_posts (supersedes_id) WHERE supersedes_id IS NOT NULL;

-- Integrity: a supersedes chain must stay within one exam (CHECK can't span rows).
CREATE OR REPLACE FUNCTION public.content_posts_supersedes_same_exam()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.supersedes_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.content_posts t
      WHERE t.id = NEW.supersedes_id
        AND t.exam_id IS DISTINCT FROM NEW.exam_id
    ) THEN
      RAISE EXCEPTION 'supersedes_id must reference a content_post in the same exam (exam_id mismatch)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS content_posts_supersedes_same_exam ON public.content_posts;
CREATE TRIGGER content_posts_supersedes_same_exam
  BEFORE INSERT OR UPDATE OF supersedes_id, exam_id ON public.content_posts
  FOR EACH ROW EXECUTE FUNCTION public.content_posts_supersedes_same_exam();

-- NOT applied here (documented, optional): hard public hiding of expired items in RLS
--   would need USING (status='published' AND (expires_at IS NULL OR expires_at > now()))
--   on public_read_content. Recommendation is the QUERY-level filter instead (keeps RLS
--   time-free and lets the exam page show a "closed" item), so this is left out.
