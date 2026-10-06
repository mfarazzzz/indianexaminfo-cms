/**
 * S2.7 golden test — the UP D.El.Ed 2026 Phase-3 notice.
 *
 * FIXTURES (src/lib/ai/__fixtures__/up-deled-2026-phase3/):
 *   pasted.txt            — the owner's ORIGINAL pasted summary, saved verbatim
 *                           (sha256 ff6babb2…d271, 11,753 bytes, CRLF — replaced
 *                           the earlier reconstruction on 2026-10-06). It
 *                           contains both required test cases: the
 *                           "updeled.gov.in?utm_source=chatgpt.com" tracking URL
 *                           and the "समस्त आवंटित अभ्यर्थी" mistranscription.
 *   model.responses.json  — the RECORDED raw model output for that text
 *                           (invented types, a distribution-list stray quoting
 *                           the page-2 DIET block, utm URL — realistic, not a
 *                           copy of expected.json); every sourceQuote/dateText
 *                           is a verbatim line of pasted.txt;
 *   expected.json         — the owner's acceptance table.
 *
 * DETERMINISTIC CI PATH: runNoticePipeline() — OUR post-processing (option
 * validation, kind/type mapping, date/time parsing, URL hygiene,
 * distribution-list rejection, eligibility source-quote check) must turn the
 * recorded raw answer into expected.json. No network.
 *
 * LIVE PATH (opt-in): LIVE=1 calls the deployed ai-fill NOTICE_EXTRACT_V1
 * template and records the answer beside the fixtures as
 * model.responses.live.json for report comparison. Runs ONLY after the owner
 * approves the Edge Function deploy (S2.3) — skipped otherwise.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runNoticePipeline } from "./noticePipeline";
import type { AllowedOptions } from "./extractionContract";

const FIX = (name: string) =>
  resolve(__dirname, `./__fixtures__/up-deled-2026-phase3/${name}`);

const pastedText = readFileSync(FIX("pasted.txt"), "utf8");
const recording = JSON.parse(readFileSync(FIX("model.responses.json"), "utf8")) as { raw: string };
const expected = JSON.parse(readFileSync(FIX("expected.json"), "utf8"));

/** The allowed options a call would read at run time (mirrors the live lists —
 *  teaching-and-education exists, up exists, entrance choices exist). */
const allowed: AllowedOptions = {
  categories: [
    { slug: "teaching-and-education", name: "Teaching and Education" },
    { slug: "engineering", name: "Engineering" },
    { slug: "management", name: "Management" },
  ],
  regions: [
    { slug: "up", label: "Uttar Pradesh" },
    { slug: "all-india", label: "All India" },
  ],
  entityTypes: ["exam", "university-admission"],
  selectionModels: ["written-exam", "merit-based", "interview-based", "internal-admission"],
};

const result = runNoticePipeline(recording.raw, allowed, pastedText, 2026);

describe("golden: UP D.El.Ed 2026 Phase-3 — fields (S2.7)", () => {
  it("name carries D.El.Ed and NOT Entrance", () => {
    const name = result.fields.name.value;
    expect(name).toBe(expected.name.value);
    expect(name).toContain("D.El.Ed");
    expect(name).not.toContain(expected.name.mustNotContain);
    expect(result.fields.name.sourceQuote).toBe(expected.name.sourceQuote);
  });

  it("category teaching-and-education and selection model merit-based (chosen WITH a reason)", () => {
    expect(result.fields.categorySlug.value).toBe(expected.categorySlug.value);
    expect(result.fields.categorySlug.flagged).toBe(false);
    expect(result.fields.selectionModel.value).toBe(expected.selectionModel.value);
    expect(result.fields.selectionModel.reason).toBe(expected.selectionModel.reason);
    expect(result.fields.entityType.value).toBe(expected.entityType.value);
    expect(result.fields.region.value).toBe(expected.region.value);
  });

  it("URL hygiene: the tracking URL loses utm_source but keeps the host", () => {
    const url = result.fields.officialWebsite.value;
    expect(url).toContain(expected.officialWebsite.host);
    expect(url).not.toMatch(/utm_|fbclid|gclid|chatgpt/i);
  });

  it("eligibility says NOT YET ALLOTTED and its quote is flagged as the mistranscription", () => {
    const el = result.fields.eligibility;
    expect(el.value).toBe(expected.eligibility.value);
    expect(el.value).toMatch(/not yet allotted/i);
    expect(el.sourceQuote).toBe(expected.eligibility.sourceQuote); // the "आवंटित" line is SHOWN
    expect(el.sourceQuote).toContain("समस्त आवंटित अभ्यर्थी");
    expect(el.flagged).toBe(true);
    expect(el.flagReason).toMatch(new RegExp(expected.eligibility.flagPattern));
  });

  it("the ₹5,000 fee is flagged 'counselling fee — no field yet', never written to application_fee", () => {
    const fee = result.fields.fee;
    expect(fee.value).toBe(expected.fee.value);
    expect(fee.flagReason).toBe(expected.fee.flag);
  });

  it("warnings / contacts / notice reference survive with quotes", () => {
    expect(result.fields.warnings.value).toBe(expected.warnings.value);
    expect(result.fields.contacts.value).toBe(expected.contacts.value);
    expect(result.fields.noticeReference.value).toBe(expected.noticeReference.value);
  });
});

describe("golden: date rows — kinds, windows, IST times (S2.7)", () => {
  it("produces EXACTLY the four Phase-3 rows expected.json defines", () => {
    expect(result.rows).toEqual(expected.dates);
  });

  it("the invented model types were OVERRIDDEN by the kind→type table", () => {
    for (const t of expected.typeInventedOverrides) {
      const hit = result.warnings.find((w) => w.includes(t.labelContains) && w.includes(t.from) && w.includes(`"${t.to}"`));
      expect(hit, `warning missing for ${t.labelContains}: ${result.warnings.join(" | ")}`).toBeTruthy();
    }
  });

  it("nothing says 'Registration Opens 5 Oct' — the window is choice_filling", () => {
    const cf = result.rows.find((r) => r.date === "2026-10-05");
    expect(cf?.kind).toBe("choice_filling");
    expect(cf?.type).toBe("counselling"); // VIEW vocabulary — drives counselling, not app-open
    expect(result.rows.some((r) => r.kind === "registration_start" && r.date === "2026-10-05")).toBe(false);
  });
});

describe("golden: provenance rows and rejections (S2.7)", () => {
  it("the counselling notice 07.08.2026 is a DOCUMENT REFERENCE, not a Notification row", () => {
    expect(result.references).toEqual(expected.references);
    expect(result.rows.some((r) => r.kind === "notification")).toBe(false);
    expect(result.rows.some((r) => r.date === "2026-08-07")).toBe(false);
  });

  it("the page-2 distribution stray is REJECTED, with the reason recorded", () => {
    expect(result.rows.some((r) => r.label === "Principals notification (all DIETs)")).toBe(false);
    const rej = result.rejected.find((r) => r.label === "Principals notification (all DIETs)");
    expect(rej).toBeTruthy();
    expect(rej!.reason).toMatch(new RegExp(expected.rejected[0].reasonPattern));
  });

  it("no distribution-list content leaked into ANY output field, row or reference", () => {
    const output = JSON.stringify({ fields: result.fields, rows: result.rows, references: result.references });
    for (const forbidden of expected.forbiddenAnywhere) {
      expect(output, `forbidden string "${forbidden}" found in pipeline output`).not.toContain(forbidden);
    }
  });
});

describe.skipIf(process.env.LIVE !== "1")("golden: live model run (LIVE=1, after S2.3 deploy approval)", () => {
  it("calls the deployed NOTICE_EXTRACT_V1 and records the answer beside the fixtures", async () => {
    // Transport: direct fetch to the deployed function, authenticated with the
    // owner's saved CMS session (.auth/cms.json) — used ONLY for ai-fill calls.
    // No token is ever printed. vitest runs from the repo root.
    const { readFileSync, writeFileSync } = await import("node:fs");
    const env = Object.fromEntries(
      readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/i.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
    );
    const state = JSON.parse(readFileSync(".auth/cms.json", "utf8")) as { origins?: { localStorage?: { name: string; value: string }[] }[] };
    let sess: { access_token?: string; refresh_token?: string } = {};
    for (const o of state.origins ?? []) for (const e of o.localStorage ?? []) {
      if (e.name.startsWith("sb-")) { try { const v = JSON.parse(e.value); sess = v.current ?? v } catch {} }
    }
    if (!sess.access_token) throw new Error("no session in .auth/cms.json — run npm run cms:login first");

    const call = async (tok: string) => fetch(`${env.VITE_SUPABASE_URL}/functions/v1/ai-fill`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ template: "NOTICE_EXTRACT_V1", pillar: "entrance-exam", consumer: "golden-live", sourceText: pastedText.replace(/\r\n/g, "\n") }),
    });
    let res = await call(sess.access_token);
    if (res.status === 401 && sess.refresh_token) {
      // The saved token ages out hourly like any browser session — refresh and
      // retry once (same endpoint the SPA client uses; token never printed).
      const rf = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ refresh_token: sess.refresh_token }),
      });
      if (!rf.ok) throw new Error(`live call 401 and refresh failed (${rf.status}) — re-run npm run cms:login`);
      const fresh = await rf.json() as { access_token?: string };
      if (!fresh.access_token) throw new Error("refresh returned no access token")
      // Persist the rotated session back into the (gitignored) storageState so
      // the next run — or the browser — starts from the current tokens.
      try {
        for (const o of state.origins ?? []) for (const e of o.localStorage ?? []) {
          if (!e.name.startsWith("sb-")) continue
          try { const v = JSON.parse(e.value); const cur = v.current ?? v; Object.assign(cur, fresh); e.value = JSON.stringify(v) } catch {}
        }
        writeFileSync(".auth/cms.json", JSON.stringify(state))
      } catch { /* non-fatal: the run itself already succeeded */ }
      res = await call(fresh.access_token);
    }
    if (!res.ok) throw new Error(`live call failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    const wire = await res.json() as { content: { fields: Record<string, unknown>; dates: Record<string, unknown>[]; references?: unknown[] }; issues?: unknown[] };
    const liveRaw = JSON.stringify({ fields: wire.content.fields, dates: wire.content.dates, references: wire.content.references ?? [] });
    // Second recording — kept for the report's live-vs-expected comparison.
    writeFileSync(FIX("model.responses.live.json"), liveRaw + "\n");

    const live = runNoticePipeline(liveRaw, allowed, pastedText.replace(/\r\n/g, "\n"), 2026);

    // Classification per the owner's rule: a wrong date, a wrong kind or a
    // missing row is a FAILURE; wording (labels, values, confidence, quotes)
    // and extra rows are FLAGS.
    const failures: string[] = [];
    const flags: string[] = [];
    const table: { row: string; expected: string; live: string; status: string }[] = [];
    const matched = new Set<number>();
    expected.dates.forEach((e: { label: string; kind: string; date: string; end_date?: string; end_time?: string }, i: number) => {
      const sameKind = live.rows.filter((r) => r.kind === e.kind);
      if (sameKind.length === 0) { failures.push(`missing row: kind ${e.kind} (expected ${e.label} ${e.date})`); table.push({ row: e.kind, expected: `${e.label} ${e.date}`, live: "—", status: "FAIL" }); return }
      const exact = sameKind.find((r) => r.date === e.date);
      if (!exact) { failures.push(`wrong date: kind ${e.kind} live=${sameKind.map((r) => r.date).join(",")} expected=${e.date}`); table.push({ row: e.kind, expected: e.date, live: sameKind.map((r) => r.date).join(","), status: "FAIL" }); return }
      matched.add(live.rows.indexOf(exact));
      if (e.end_date && (exact.end_date ?? "") !== e.end_date) failures.push(`wrong end_date: ${e.kind} live=${exact.end_date ?? ""} expected=${e.end_date}`);
      else if (!e.end_date && exact.end_date) failures.push(`extra end_date on ${e.kind}: ${exact.end_date}`);
      table.push({ row: e.kind, expected: `${e.date}${e.end_date ? "→" + e.end_date : ""}${e.end_time ? " " + e.end_time : ""}`, live: `${exact.date}${exact.end_date ? "→" + exact.end_date : ""}${exact.end_time ? " " + exact.end_time : ""}`, status: "ok" })
    })
    live.rows.forEach((r, i) => { if (!matched.has(i)) flags.push(`extra live row: ${r.kind} ${r.label} ${r.date} (wording/scope difference — not a failure by itself)`) })
    for (const [f, exp] of Object.entries({ categorySlug: expected.categorySlug.value, selectionModel: expected.selectionModel.value }) as [string, string][]) {
      const got = live.fields[f]?.value ?? ""
      if (got !== exp) flags.push(`${f}: live="${got}" expected="${exp}" (field wording/choice — flag)`)
    }
    // eslint-disable-next-line no-console
    console.table(table)
    if (flags.length) { console.log("LIVE FLAGS:"); flags.forEach((f) => console.log("  -", f)) }
    expect(failures).toEqual([])
    // Core acceptance on live data (failures per the rule):
    expect(live.rows.some((r) => r.kind === "choice_filling" && r.date === "2026-10-05")).toBe(true)
    expect(live.rows.some((r) => r.kind === "institute_lock" && r.date === "2026-10-15")).toBe(true)
  }, 90_000)
});
