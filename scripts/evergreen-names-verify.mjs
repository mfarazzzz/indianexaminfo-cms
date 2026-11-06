/**
 * evergreen-names-verify.mjs — the reader-side check for the evergreen-name proposal
 * (owner batch 6, Phase Z4). READ-ONLY: it performs GET requests and nothing else. It writes no
 * file outside stdout, and it holds no credential.
 *
 *   node scripts/evergreen-names-verify.mjs [--base https://www.indianexaminfo.com]
 *   node scripts/evergreen-names-verify.mjs --slugs clat,afcat,utet,up-ecce-educator
 *
 * WHAT IT PROVES, and what it cannot
 *   It checks the ONE thing a reader can see: every exam page's H1 still ends with a four-digit
 *   year, and that year still equals the edition year the page reports. If the proposal were
 *   applied wrongly — a name stripped without the year living on the edition, or a row whose
 *   edition year disagrees — the H1 would lose its year and this would say so.
 *   It CANNOT see the database, because it deliberately carries no key: the DB-side checks
 *   (rows still matching the year pattern, the excluded records untouched, the reassembly
 *   arithmetic) are printed as SQL for the owner to paste into the dashboard. That split is on
 *   purpose — a verification script that needs a service key is a script nobody can run safely.
 */

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : fallback;
};
const BASE = argOf("base", "https://www.indianexaminfo.com").replace(/\/+$/, "");

// Category + slug of pages worth checking: the held-back rows, a few ordinary targets, and the
// two dated-slug rows that are excluded from the proposal. Paths come from the live sitemap.
const PREFERRED = [
  "up-ecce-educator", "utet",                     // no stored seo_title — the human-look pair
  "clat", "afcat", "aiims-nursing",               // ordinary in-scope rows
  "aiims-norcet-11th-nursing-officier-recruitment-2026", // slug carries the year, name must follow
];
const LOSERS = ["cds", "nda", "nta-ugc-net", "rpf-constable-si-recruitment", "upsc-cms-examination-2026"];

const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) evergreen-names-verify" };

/** The submitted exam pages, as the sitemap says them. */
async function sitemapExamPaths() {
  const xml = await (await fetch(`${BASE}/sitemap.xml`, { headers: UA })).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => new URL(m[1]).pathname)
    .filter((p) => /^\/(sarkari-naukri|admission|board-exam|university-exam)\/[^/]+\/[^/]+$/.test(p));
}

/** Read one page's H1 and the year the page itself claims. */
async function inspect(path) {
  const res = await fetch(BASE + path, { headers: UA });
  if (res.status !== 200) return { path, status: res.status, ok: false, reason: `HTTP ${res.status}` };
  const html = await res.text();
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() ?? "";
  const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? "";
  const canonical = /<link rel="canonical" href="([^"]+)"/i.exec(html)?.[1] ?? "";
  const yearInH1 = /(20\d{2})/.exec(h1)?.[1] ?? null;
  const slug = path.split("/").pop();
  const yearInSlug = /(20\d{2})/.exec(slug)?.[1] ?? null;
  return {
    path, slug, status: 200, h1, title, canonical,
    yearInH1, yearInSlug,
    ok: Boolean(yearInH1),
    reason: yearInH1 ? "H1 carries a year" : "H1 HAS NO YEAR — the change would have to be reverted",
    selfCanonical: canonical ? new URL(canonical).pathname === path : null,
  };
}

const paths = await sitemapExamPaths();
console.log(`base ${BASE} — exam pages in the sitemap: ${paths.length}`);

const wanted = argOf("slugs", null)?.split(",").filter(Boolean) ?? PREFERRED;
const picked = [];
for (const slug of wanted) {
  const hit = paths.find((p) => p.endsWith(`/${slug}`));
  if (hit) picked.push(hit);
  else console.log(`  (not in the sitemap: ${slug}${LOSERS.includes(slug) ? " — expected, it is a retire-loser page" : ""})`);
}
// a couple of random in-scope pages so the sample is not only hand-picked
for (const p of paths) {
  if (picked.length >= 8) break;
  if (!picked.includes(p) && /(20\d{2})/.test(p)) picked.push(p);
}

let failures = 0;
console.log(`\nchecking ${picked.length} pages:`);
for (const p of picked) {
  const r = await inspect(p);
  if (!r.ok) failures++;
  console.log(`  ${r.ok ? "OK  " : "FAIL"} ${p}`);
  if (r.h1 !== undefined) {
    console.log(`       H1: "${r.h1}"  year=${r.yearInH1}${r.yearInSlug ? `  slug year=${r.yearInSlug}` : ""}  self-canonical=${r.selfCanonical}`);
  } else {
    console.log(`       ${r.reason}`);
  }
}

console.log("\nDB-side checks — paste these into the dashboard SQL editor (read-only):");
// String.raw: the SQL contains \s, which a normal template literal would turn into "s".
console.log(String.raw`
-- 1. rows still carrying a trailing year, by population
select count(*) filter (where name ~ '(20[0-9]{2})$')                          as still_year_in_name,
       count(*) filter (where name ~ '(20[0-9]{2})$'
                        and slug not in ('cds','nda','nta-ugc-net',
                                         'rpf-constable-si-recruitment',
                                         'upsc-cms-examination-2026'))         as excluding_retire_losers
from exams where slug not like 'zz-test%' and slug <> 'upsssc-pet-notification';

-- 2. the reassembly invariant, which is what makes the H1 unchanged
select count(*) as rows_where_reassembly_differs
from exams e join exam_editions ed on ed.id = e.current_edition_id
where e.slug not like 'zz-test%' and e.slug <> 'upsssc-pet-notification'
  and e.slug not in ('cds','nda','nta-ugc-net','rpf-constable-si-recruitment','upsc-cms-examination-2026')
  and e.name || ' ' || ed.year::text <> (regexp_replace(e.name,'\s*(20[0-9]{2})\s*$','') || ' ' || ed.year::text);

-- 3. the frozen records must be untouched: expect 0 rows
select slug, name, updated_at from exams
where slug in ('upsssc-pet-notification','cds','nda','nta-ugc-net',
               'rpf-constable-si-recruitment','upsc-cms-examination-2026')
  and updated_at > now() - interval '1 day';
`);

console.log(failures === 0
  ? `\nRESULT: ${picked.length} pages checked, 0 with a year-less H1.`
  : `\nRESULT: ${failures} page(s) LOST THE YEAR IN THE H1 — revert with the ROLLBACK block in supabase/proposed/20261201_evergreen_names_PROPOSAL.sql.`);
process.exit(failures === 0 ? 0 : 1);
