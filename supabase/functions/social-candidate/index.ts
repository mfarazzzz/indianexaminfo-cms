/**
 * social-candidate — Edge Function (S7.1b). Inserts a DRAFT social_posts row from a
 * publish/verify event, idempotently. Deployed WITH verify_jwt (default): the caller
 * must present a valid signed-in user's JWT, and the INSERT is gated by the
 * social_posts_staff_write RLS policy (manage_social). No service key is required —
 * the user's own token is used, so the CMS can call it directly.
 *
 * It NEVER posts. It only records a candidate for a human to approve. The caption is
 * built from STRUCTURED fields only (../_shared/social.ts) — never free text.
 *
 * Env (owner-set): SUPABASE_URL, SUPABASE_ANON_KEY, PUBLIC_SITE_URL (the reader origin,
 * e.g. https://www.indianexaminfo.com). No token here.
 *
 * Owner batch 8, H3 — a VACANCY is now a first-class candidate (source_type
 * 'sarkari_naukri', a value `social_posts.source_type` already accepts: it is free text
 * with no CHECK constraint, verified on the live database). The vacancy's own COLUMNS
 * build the caption — title, organisation, state, last date, post count, the reader page
 * — and NEVER a sentence copied out of the notice. A vacancy only becomes a candidate
 * once it is BOTH published and verified: an unverified vacancy has not been checked
 * against the official notification, so it must not reach a channel.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildCaption, buildVacancyCaption, idempotencyKey, isSameSiteUrl, pickLandingUrl,
  testContentRefusal, VACANCY_SOURCE_TYPE, type CaptionInput, type VacancyCaptionInput,
} from "../_shared/social.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
// The PUBLIC reader origin. Deliberately not SUPABASE_URL: a landing link must be a page a
// reader can open, and until now this function fell back to the project host when the caller
// passed no page_url — which both CMS call sites do (they pass "").
const SITE_URL = (Deno.env.get("PUBLIC_SITE_URL") ?? "").replace(/\/+$/, "");

const STATUS_LABELS: Record<string, string> = {
  "registration-open": "Applications open",
  "admit-card-out": "Admit card released",
  "result-declared": "Result declared",
  "notified": "Notification released",
  "upcoming": "Upcoming",
};

Deno.serve(async (req) => {
  // verify_jwt is ON, but double-check a user token is present and use it for the
  // insert so RLS (manage_social) is what actually authorises the write.
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
  }
  let body: { source_type?: string; source_id?: string; event?: string; channel?: string; page_url?: string };
  try { body = await req.json(); } catch { return json({ ok: false, error: "bad json" }, 400); }

  const { source_type = "exam", source_id, event = "published", channel = "telegram", page_url = "" } = body;
  if (!source_id) return json({ ok: false, error: "source_id required" }, 400);

  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
  });

  // H-3a: the landing URL must BE the reader page. Build it through the frontend's own
  // resolver (/go/{slug}, the single place the pillar → segment fact lives) and follow its
  // 308 once, so the stored landing_url is the final URL rather than a redirect.
  if (!SITE_URL) return json({ ok: false, error: "PUBLIC_SITE_URL is not configured" }, 502);

  // ── A VACANCY candidate (owner batch 8, H3) ─────────────────────────────────
  if (source_type === VACANCY_SOURCE_TYPE) {
    return await vacancyCandidate(supabase, {
      sourceId: source_id, event, channel, pageUrl: page_url,
    });
  }

  // Pull the STRUCTURED fields only — name, derived status, the one date, official link, page URL.
  const { data: exam, error } = await supabase.from("exam_derived_status")
    .select("exam_id, derived_status, app_close_date, admit_card_date, result_date")
    .eq("exam_id", source_id).maybeSingle();
  if (error || !exam) return json({ ok: false, error: "exam not found" }, 404);

  const { data: meta } = await supabase.from("exams").select("name, slug, pillar, official_website")
    .eq("id", source_id).maybeSingle();
  if (!meta) return json({ ok: false, error: "exam meta missing" }, 404);

  const landing = await resolveLanding(meta.slug, page_url);
  if (!landing) return json({ ok: false, error: "no landing url could be resolved" }, 502);

  // J3/P5 — reference TEST content is NEVER queued for posting, whatever the caller asked for.
  // The decision lives in the shared, unit-tested predicate: both halves are checked because
  // the landing URL is resolver-derived (a test record would otherwise arrive as a clean
  // /sarkari-naukri/zz-test-… path) and a caller-supplied page_url is otherwise honoured
  // verbatim when it is on our own host.
  const refusal = testContentRefusal({ slug: meta.slug, landingUrl: landing });
  if (refusal) {
    return json({ ok: false, error: "reference test content is never queued", reason: refusal }, 422);
  }

  // The one date that matters, by event/status — never invented.
  const dateMap: Record<string, { label: string; iso: string | null }> = {
    "registration-open": { label: "Last date", iso: exam.app_close_date },
    "admit-card-out": { label: "Admit card", iso: exam.admit_card_date },
    "result-declared": { label: "Result", iso: exam.result_date },
  };
  const pick = dateMap[exam.derived_status] ?? { label: "", iso: null };
  const captionInput: CaptionInput = {
    examName: meta.name,
    derivedStatusLabel: STATUS_LABELS[exam.derived_status] ?? "",
    dateLabel: pick.label || null,
    dateISO: pick.iso || null,
    officialUrl: meta.official_website,
    pageUrl: landing, // resolved above through the frontend's /go/{slug} (never the project host)
  };
  const caption = buildCaption(captionInput);

  const key = idempotencyKey(channel, source_type, source_id, event);
  const { error: insErr } = await supabase.from("social_posts").upsert(
    { status: "draft", channel, source_type, source_id, source_label: meta.name, caption, landing_url: captionInput.pageUrl, idempotency_key: key },
    { onConflict: "idempotency_key", ignoreDuplicates: true },
  );
  if (insErr) return json({ ok: false, error: insErr.message }, 500);
  return json({ ok: true, idempotency_key: key });
});

/**
 * The reader page for a record, resolved through the frontend's own /go/{slug} resolver
 * and then followed once, so the stored landing_url is the FINAL url rather than a
 * redirect. A vacancy resolves to /sarkari-naukri/{slug} through the same resolver
 * (the frontend answers exams first, then sarkari_naukri).
 */
async function resolveLanding(slug: string, pageUrl: string): Promise<string> {
  let landing = pickLandingUrl({ pageUrl, slug, siteUrl: SITE_URL });
  if (!landing) return "";
  if (/\/go\//.test(landing)) {
    try {
      const r = await fetch(landing, { redirect: "follow", headers: { "user-agent": "social-candidate/1" } });
      if (r.ok && isSameSiteUrl(r.url, SITE_URL)) landing = r.url;
    } catch { /* keep the resolver URL — one hop still lands the reader on the right page */ }
  }
  return landing;
}

/**
 * Owner batch 8, H3 — the vacancy candidate.
 *
 * Three rules live here:
 *   1. THE ROW MUST BE PUBLISHED AND VERIFIED. Anything else is refused with a plain
 *      reason (422) rather than queued. The DB is the authority on both facts; the CMS
 *      client also checks them, but this is the gate that counts.
 *   2. THE CAPTION IS BUILT FROM COLUMNS. title, organization, the state label, the
 *      post count and the last date — every one of them a field somebody filled in.
 *      Nothing from the notice text is ever read. A missing end date OMITS the date
 *      line; it is never invented.
 *   3. THE zz-test GUARD IS THE SHARED ONE. testContentRefusal refuses the record's own
 *      slug and a landing URL that points at reference test content.
 */
async function vacancyCandidate(
  supabase: any,
  args: { sourceId: string; event: string; channel: string; pageUrl: string },
): Promise<Response> {
  const { data: vac, error } = await supabase
    .from("sarkari_naukri")
    .select("id, slug, title, organization, state, vacancy_count, application_end_date, workflow_status, verified_at")
    .eq("id", args.sourceId).maybeSingle();
  if (error) return json({ ok: false, error: error.message }, 500);
  if (!vac) return json({ ok: false, error: "vacancy not found" }, 404);

  if (vac.workflow_status !== "published") {
    return json({ ok: false, error: "the vacancy is not published yet" }, 422);
  }
  if (!vac.verified_at) {
    return json({ ok: false, error: "the vacancy is not verified against the official notice yet" }, 422);
  }

  const landing = await resolveLanding(vac.slug, args.pageUrl);
  if (!landing) return json({ ok: false, error: "no landing url could be resolved" }, 502);

  const refusal = testContentRefusal({ slug: vac.slug, landingUrl: landing });
  if (refusal) {
    return json({ ok: false, error: "reference test content is never queued", reason: refusal }, 422);
  }

  // The state LABEL ("Uttar Pradesh"), never the slug. `regions` is readable by everyone
  // (its policy is `using true`), and a missing label only drops one line of the caption.
  let stateLabel = "";
  if (vac.state) {
    const { data: region } = await supabase.from("regions").select("label").eq("slug", vac.state).maybeSingle();
    stateLabel = region?.label ?? "";
  }

  const captionInput: VacancyCaptionInput = {
    title: vac.title ?? "",
    organization: vac.organization ?? null,
    stateLabel,
    vacancyCount: vac.vacancy_count ?? null,
    applicationEndDate: vac.application_end_date ?? null,
    pageUrl: landing,
  };
  const caption = buildVacancyCaption(captionInput);

  const key = idempotencyKey(args.channel, VACANCY_SOURCE_TYPE, args.sourceId, args.event);
  const { error: insErr } = await supabase.from("social_posts").upsert(
    {
      status: "draft", channel: args.channel, source_type: VACANCY_SOURCE_TYPE,
      source_id: args.sourceId, source_label: vac.title ?? null, caption,
      landing_url: landing, idempotency_key: key,
    },
    { onConflict: "idempotency_key", ignoreDuplicates: true },
  );
  if (insErr) return json({ ok: false, error: insErr.message }, 500);
  return json({ ok: true, idempotency_key: key, source_type: VACANCY_SOURCE_TYPE });
}

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
}
