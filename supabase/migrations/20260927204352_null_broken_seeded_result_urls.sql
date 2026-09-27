-- ─────────────────────────────────────────────────────────────────────────────
-- M4: neutralise broken seeded result_url values.
--
-- Background: all 361 sarkari_naukri rows carry a seeded result_url. Once a row
-- is verified, the frontend "Check Result / View Merit List" button renders that
-- link (L4b gate). 87 of those links are broken and would go live on verify:
--   • 74 rows point at one of 53 NXDOMAIN (verified-dead) domains — the host no
--     longer resolves at all (re-confirmed 2026-09-28 against 8.8.8.8/1.1.1.1
--     with a working control; matches the L4a finding exactly).
--   • 13 rows point at a live domain but a deep path that returns HTTP 404
--     (GET-verified in J5): the org root is alive, the seeded "/results" path is
--     wrong.
-- hssc.gov.in and icdsbih.gov.in returned TIMEOUT (inconclusive), NOT NXDOMAIN,
-- so they are deliberately EXCLUDED here and left for a manual recheck — a
-- timeout is not proof of death.
--
-- This script copies the affected (id, slug, result_url) into a backup table,
-- then sets result_url = NULL on exactly those rows, and asserts the count is
-- 87 (aborts the transaction otherwise). Trigger-safe: result_url is not a
-- gated field, so nulling it never clears/forces verified_at.
--
-- Expected: 74 dead-domain + 13 confirmed-404 = 87 distinct rows (disjoint).
--
-- The backup table gets RLS enabled with NO policies (deny-all through the API),
-- per the 26 Sep rule for backup tables — service role / direct SQL can still
-- read it for any rollback, but anon/authenticated cannot.
--
-- NOTE: no BEGIN/COMMIT here — the migration runner wraps each file in a
-- transaction, so the DO block's RAISE EXCEPTION aborts the whole change.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  expected int  := 87;
  n_targets int;
  n_updated int;
  n_dead    int;
  n_404     int;
BEGIN
  -- Normalise each result_url into host + path and select the broken ones.
  -- Both target sets are expressed as VALUES CTEs (valid SQL; avoids the
  -- unnest(text[][]) scalar-flattening pitfall).
  CREATE TEMP TABLE _broken_targets ON COMMIT DROP AS
  WITH base AS (
    SELECT
      id, slug, result_url,
      lower(split_part(replace(replace(replace(result_url,'https://',''),'http://',''),'www.',''),'/',1)) AS host,
      '/' || nullif(split_part(replace(replace(replace(result_url,'https://',''),'http://',''),'www.',''),'/',2),'') AS path
    FROM public.sarkari_naukri
    WHERE result_url IS NOT NULL AND btrim(result_url) <> ''
  ),
  -- The 53 verified-dead (NXDOMAIN) result_url hosts.
  dead_hosts(host) AS (VALUES
    ('agranagarnigam.in'),('ahmednagarzp.gov.in'),('bhopalnagarnigam.org'),('dgmeup.gov.in'),
    ('fisheries.up.nic.in'),('gorakhpurnagarnigam.in'),('gramasachivalayam.ap.gov.in'),
    ('highereducation.up.gov.in'),('homeguard.bihar.gov.in'),('hprd.nic.in'),
    ('irrigation.up.nic.in'),('jalgaonzp.gov.in'),('kolhapurzp.gov.in'),('lrc.bihar.gov.in'),
    ('mahrevenue.gov.in'),('mgnrega.bihar.gov.in'),('mpsrtc.nic.in'),('mpworks.gov.in'),
    ('mwr.bihar.gov.in'),('myvmc.karnataka.gov.in'),('nagarnigamlucknow.com'),
    ('nagarnigamvaranasi.com'),('nagarpalikaup.gov.in'),('nagpurzp.gov.in'),
    ('nhm.telangana.gov.in'),('nrhm.gujarat.gov.in'),('nrhm.maharashtra.gov.in'),
    ('panchayat.cg.gov.in'),('panchayatiraj.bihar.gov.in'),('patnanagarnigam.gov.in'),
    ('pbwcd.punjab.gov.in'),('peb.mp.gov.in'),('prayagrajnagarnigam.in'),('raigadzp.gov.in'),
    ('rcd.bihar.gov.in'),('rmc.jharkhand.gov.in'),('rsrtc.rajasthan.gov.in'),('sanglizp.gov.in'),
    ('satarazp.gov.in'),('socialwelfare.up.nic.in'),('solapurzp.gov.in'),('thanezp.gov.in'),
    ('tspri.telangana.gov.in'),('upcoop.gov.in'),('upcooperative.in'),('updsd.gov.in'),
    ('upprisonreform.in'),('urban.bihar.gov.in'),('wbagri.gov.in'),('wbwcd.gov.in'),
    ('wcd.assam.gov.in'),('wcd.jharkhand.gov.in'),('wcdodisha.gov.in')
  ),
  -- Live domains whose seeded deep path is a confirmed HTTP 404 (host, path).
  links_404(host, path) AS (VALUES
    ('aiimsexams.ac.in','/results'),('csirnet.nta.nic.in','/results'),
    ('ctet.nic.in','/results'),('drdo.gov.in','/results'),('licindia.in','/results'),
    ('nabard.org','/results'),('rbi.org.in','/results'),('sail.co.in','/results'),
    ('uppsc.up.nic.in','/results'),('upsssc.gov.in','/results'),
    ('jharkhand.gov.in','/panchayat')
  )
  SELECT b.id, b.slug, b.result_url,
         (b.host IN (SELECT host FROM dead_hosts)) AS is_dead,
         EXISTS (SELECT 1 FROM links_404 e WHERE e.host = b.host AND e.path = b.path) AS is_404
  FROM base b
  WHERE b.host IN (SELECT host FROM dead_hosts)
     OR EXISTS (SELECT 1 FROM links_404 e WHERE e.host = b.host AND e.path = b.path);

  SELECT count(*), count(*) FILTER (WHERE is_dead), count(*) FILTER (WHERE is_404)
    INTO n_targets, n_dead, n_404
  FROM _broken_targets;

  RAISE NOTICE 'M4 targets: % rows (dead-domain %, confirmed-404 %)', n_targets, n_dead, n_404;

  -- Assert the count matches the certified figure; abort otherwise.
  IF n_targets <> expected THEN
    RAISE EXCEPTION 'ABORT: targeted % broken result_url rows, expected %; no changes committed', n_targets, expected;
  END IF;
  IF n_dead <> 74 OR n_404 <> 13 THEN
    RAISE EXCEPTION 'ABORT: breakdown dead=% / 404=% does not match 74/13; no changes committed', n_dead, n_404;
  END IF;

  -- Backup first (permanent table; audit + restore source of truth).
  CREATE TABLE IF NOT EXISTS public.broken_result_urls_backup_20260928 (
    id           uuid,
    slug         text,
    result_url   text,
    reason       text,
    backed_up_at timestamptz NOT NULL DEFAULT now()
  );

  -- Deny-all through the API: enable RLS with no policies (26 Sep backup rule).
  ALTER TABLE public.broken_result_urls_backup_20260928 ENABLE ROW LEVEL SECURITY;

  INSERT INTO public.broken_result_urls_backup_20260928 (id, slug, result_url, reason)
  SELECT id, slug, result_url,
         CASE WHEN is_dead THEN 'nxdomain-dead-host' ELSE 'confirmed-404-deeplink' END
  FROM _broken_targets;

  -- Null result_url on exactly the targeted rows.
  UPDATE public.sarkari_naukri s
  SET result_url = NULL
  FROM _broken_targets t
  WHERE s.id = t.id;

  GET DIAGNOSTICS n_updated = ROW_COUNT;

  IF n_updated <> expected THEN
    RAISE EXCEPTION 'ABORT: updated % rows, expected %; rolling back', n_updated, expected;
  END IF;

  RAISE NOTICE 'M4 complete: nullified result_url on % rows; backup table has % rows.',
    n_updated, (SELECT count(*) FROM public.broken_result_urls_backup_20260928);
END $$;
