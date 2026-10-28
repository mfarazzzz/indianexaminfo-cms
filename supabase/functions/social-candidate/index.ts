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
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCaption, idempotencyKey, isSameSiteUrl, pickLandingUrl, type CaptionInput } from "../_shared/social.ts";

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

  // Pull the STRUCTURED fields only — name, derived status, the one date, official link, page URL.
  const { data: exam, error } = await supabase.from("exam_derived_status")
    .select("exam_id, derived_status, app_close_date, admit_card_date, result_date")
    .eq("exam_id", source_id).maybeSingle();
  if (error || !exam) return json({ ok: false, error: "exam not found" }, 404);

  const { data: meta } = await supabase.from("exams").select("name, slug, pillar, official_website")
    .eq("id", source_id).maybeSingle();
  if (!meta) return json({ ok: false, error: "exam meta missing" }, 404);

  // H-3a: the landing URL must BE the reader page. Build it through the frontend's own
  // resolver (/go/{slug}, the single place the pillar → segment fact lives) and follow its
  // 308 once, so the stored landing_url is the final URL rather than a redirect.
  if (!SITE_URL) return json({ ok: false, error: "PUBLIC_SITE_URL is not configured" }, 502);
  let landing = pickLandingUrl({ pageUrl: page_url, slug: meta.slug, siteUrl: SITE_URL });
  if (!landing) return json({ ok: false, error: "no landing url could be resolved" }, 502);
  if (/\/go\//.test(landing)) {
    try {
      const r = await fetch(landing, { redirect: "follow", headers: { "user-agent": "social-candidate/1" } });
      if (r.ok && isSameSiteUrl(r.url, SITE_URL)) landing = r.url;
    } catch { /* keep the resolver URL — one hop still lands the reader on the right page */ }
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

function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
}
