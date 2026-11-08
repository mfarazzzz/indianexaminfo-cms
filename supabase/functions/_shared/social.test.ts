/**
 * social.test.ts — E3 unit tests for the pure social-queue logic (no Deno, no fetch).
 * Covers: caption built from structured fields only (no invented facts, missing-date
 * case, Telegram-HTML escaping, hard max length), idempotency key, daily-cap boundary,
 * the kill_switch/dry_run/cap/config short-circuit order, and that the bot token never
 * appears in a caption, a payload, or a (redacted) log string.
 */
import { describe, it, expect } from "vitest";
import {
  buildCaption, escapeTelegramHtml, idempotencyKey, capExceeded,
  redactError, telegramPayload, evaluateQueueGate, officialHost,
  goResolverUrl, isSameSiteUrl, pickLandingUrl,
  queueHeadroom, isTestSlug, landingUrlIsTest, testContentRefusal,
  buildVacancyCaption, groupDigits, VACANCY_SOURCE_TYPE,
  TELEGRAM_CAPTION_MAX,
} from "./social";

const TOKEN = "123456789:AA-supersecret-token-value-abcdefghij";

describe("buildCaption — structured fields only", () => {
  it("includes only the fields given; a missing date omits the date line", () => {
    const c = buildCaption({ examName: "SSC CGL 2026", derivedStatusLabel: "Applications open", dateLabel: null, dateISO: null, officialUrl: "https://ssc.gov.in/x?utm=1", pageUrl: "https://www.indianexaminfo.com/sarkari-naukri/ssc-cgl" });
    expect(c).toContain("SSC CGL 2026");
    expect(c).toContain("Applications open");
    expect(c).not.toContain("Last date");           // no date → no date line (never invented)
    expect(c).toContain("Official: ssc.gov.in");    // host only, no query
    expect(c).toContain("indianexaminfo.com/sarkari-naukri/ssc-cgl");
  });
  it("escapes Telegram HTML", () => {
    const c = buildCaption({ examName: "A & B <script>", derivedStatusLabel: "x", pageUrl: "u" });
    expect(c).toContain("&amp;");
    expect(c).toContain("&lt;script&gt;");
    expect(c).not.toContain("<script>");
  });
  it("clips to the hard max length", () => {
    const c = buildCaption({ examName: "N".repeat(2000), derivedStatusLabel: "", pageUrl: "u" });
    expect(c.length).toBeLessThanOrEqual(TELEGRAM_CAPTION_MAX);
  });
});

describe("helpers", () => {
  it("idempotencyKey is channel|sourceType|sourceId|event", () => {
    expect(idempotencyKey("telegram", "exam", "abc", "verified")).toBe("telegram|exam|abc|verified");
  });
  it("officialHost returns the host, tolerates junk", () => {
    expect(officialHost("https://uppsc.up.nic.in/Apply?x=1")).toBe("uppsc.up.nic.in");
    expect(officialHost("not a url")).toBe("");
    expect(officialHost(null)).toBe("");
  });
  it("capExceeded boundary at the IST-day count", () => {
    expect(capExceeded(19, 20)).toBe(false);
    expect(capExceeded(20, 20)).toBe(true);   // at the cap → stop
  });
  it("escapeTelegramHtml covers & < >", () => {
    expect(escapeTelegramHtml("<a>&")).toBe("&lt;a&gt;&amp;");
  });
});

describe("evaluateQueueGate — short-circuit order", () => {
  const ctx = { sentToday: 0, hasToken: true, hasChat: true };
  it("kill_switch wins over everything (posts nothing)", () => {
    expect(evaluateQueueGate({ kill_switch: true, dry_run: true, cap: 20 }, ctx)).toBe("killed");
  });
  it("dry_run next", () => {
    expect(evaluateQueueGate({ kill_switch: false, dry_run: true, cap: 20 }, ctx)).toBe("dry_run");
  });
  it("cap next", () => {
    expect(evaluateQueueGate({ kill_switch: false, dry_run: false, cap: 20 }, { ...ctx, sentToday: 20 })).toBe("cap_reached");
  });
  it("missing token/chat → config_missing", () => {
    expect(evaluateQueueGate({ kill_switch: false, dry_run: false, cap: 20 }, { sentToday: 0, hasToken: false, hasChat: true })).toBe("config_missing");
  });
  it("otherwise send", () => {
    expect(evaluateQueueGate({ kill_switch: false, dry_run: false, cap: 20 }, ctx)).toBe("send");
  });
});

describe("token safety", () => {
  it("redactError removes the token and any token-shaped run", () => {
    const msg = `Telegram 401 Unauthorized: bad token ${TOKEN} in call`;
    const r = redactError(msg, TOKEN);
    expect(r).not.toContain(TOKEN);
    expect(r).toContain("[redacted]");
    expect(redactError("see 123456789:AA-supersecret-token-value-abcdefghij", "")).not.toContain("supersecret");
  });
  it("telegramPayload never contains the token", () => {
    const p = telegramPayload("@chan", "hello");
    expect(JSON.stringify(p)).not.toContain(TOKEN);
  });
});

/**
 * H-3a (owner batch 3). A candidate used to store `page_url || SUPABASE_URL`, and both CMS
 * callers pass page_url "" — so the landing link would have been the Supabase project host,
 * not the reader page. These pin the rule that replaced it: the link is always on the public
 * site, and the Supabase host can never be written into it again.
 */
describe("landing url — the reader page, never the project host", () => {
  const SITE = "https://www.indianexaminfo.com";
  const PROJECT = "https://cwbhhcqsrbuoybeaondk.supabase.co";

  it("goResolverUrl builds the frontend resolver path from the slug", () => {
    expect(goResolverUrl(SITE, "SSC-CGL")).toBe("https://www.indianexaminfo.com/go/ssc-cgl");
    expect(goResolverUrl(`${SITE}/`, "ssc cgl")).toBe("https://www.indianexaminfo.com/go/ssc%20cgl");
    expect(goResolverUrl("", "ssc-cgl")).toBe("");
    expect(goResolverUrl(SITE, "")).toBe("");
  });

  it("isSameSiteUrl accepts only http(s) on the site host", () => {
    expect(isSameSiteUrl(`${SITE}/sarkari-naukri/ssc/ssc-cgl`, SITE)).toBe(true);
    expect(isSameSiteUrl(PROJECT, SITE)).toBe(false);
    expect(isSameSiteUrl("https://evil.example/x", SITE)).toBe(false);
    expect(isSameSiteUrl("not a url", SITE)).toBe(false);
  });

  it("pickLandingUrl: a caller URL on the site wins; anything else resolves through /go", () => {
    expect(pickLandingUrl({ pageUrl: `${SITE}/admission/medical/neet-ug`, slug: "neet-ug", siteUrl: SITE }))
      .toBe("https://www.indianexaminfo.com/admission/medical/neet-ug");
    // the empty page_url both CMS hooks pass today
    expect(pickLandingUrl({ pageUrl: "", slug: "neet-ug", siteUrl: SITE }))
      .toBe("https://www.indianexaminfo.com/go/neet-ug");
    // a caller URL that is NOT ours (a pasted official link) is ignored, never stored
    expect(pickLandingUrl({ pageUrl: "https://ssc.gov.in/x", slug: "ssc-cgl", siteUrl: SITE }))
      .toBe("https://www.indianexaminfo.com/go/ssc-cgl");
    // and the Supabase project host can never be the answer
    expect(pickLandingUrl({ pageUrl: PROJECT, slug: "ssc-cgl", siteUrl: SITE })).not.toBe(PROJECT);
    expect(pickLandingUrl({ pageUrl: "", slug: "", siteUrl: "" })).toBe("");
  });
});

/** J2-4 — the worker's batch size, in ONE pure function rather than inline arithmetic. */
describe("queueHeadroom — cap - sent - queued, never negative", () => {
  it("subtracts both spent counts", () => {
    expect(queueHeadroom(20, 0, 0)).toBe(20);
    expect(queueHeadroom(20, 7, 0)).toBe(13);
    expect(queueHeadroom(20, 7, 3)).toBe(10);          // a claim in flight is capacity spent
  });
  it("clamps at zero, including when the cap is already exceeded", () => {
    expect(queueHeadroom(20, 20, 0)).toBe(0);
    expect(queueHeadroom(20, 18, 5)).toBe(0);
    expect(queueHeadroom(0, 0, 0)).toBe(0);
  });
  it("tolerates nulls/floats from SQL rather than returning NaN", () => {
    expect(queueHeadroom(20, null as unknown as number, undefined as unknown as number)).toBe(20);
    expect(queueHeadroom(20.9, 3.2, 1.7)).toBe(16);
  });
});

/** J3 — reference TEST content must never be posted, by either edge the owner named. */
describe("test content is refused (J3)", () => {
  it("isTestSlug matches the shared prefix rule, case-insensitively", () => {
    expect(isTestSlug("zz-test-government-exam")).toBe(true);
    expect(isTestSlug(" ZZ-TEST-x ")).toBe(true);
    expect(isTestSlug("ssc-cgl")).toBe(false);
    expect(isTestSlug("")).toBe(false);
    expect(isTestSlug(null)).toBe(false);
  });

  it("landingUrlIsTest looks at path SEGMENTS, not at the whole string", () => {
    expect(landingUrlIsTest("https://www.indianexaminfo.com/sarkari-naukri/zz-test-vacancy-2026")).toBe(true);
    expect(landingUrlIsTest("https://www.indianexaminfo.com/admission/medical/zz-test-entrance-exam")).toBe(true);
    // encoded slash cannot hide a test segment
    expect(landingUrlIsTest("https://x/sarkari-naukri/zz%2Dtest-vacancy")).toBe(true);
    // a real slug that merely contains the letters is NOT refused
    expect(landingUrlIsTest("https://x/sarkari-naukri/up-anganwadi-bharti-2026")).toBe(false);
    expect(landingUrlIsTest("https://x/blog/exam-prep/zz-notes-guide")).toBe(false);
    expect(landingUrlIsTest("")).toBe(false);
    expect(landingUrlIsTest(null)).toBe(false);
  });
});

/**
 * P5 (owner batch 5) — the SAME predicate both Edge Functions now call, so "a candidate for a
 * zz-test- exam is refused" is a fact proven by a test rather than by reading an `if` in a
 * file that nothing here can execute (there is no Deno in this repo's test run).
 */
describe("testContentRefusal — the one decision social-candidate and social-publish share (P5)", () => {
  it("refuses the record the candidate came from", () => {
    expect(testContentRefusal({ slug: "zz-test-entrance-exam", landingUrl: "https://x/admission/medical/zz-test-entrance-exam" }))
      .toBe("reference test exam");
    expect(testContentRefusal({ slug: "ssc-cgl", landingUrl: "https://x/sarkari-naukri/ssc/ssc-cgl" })).toBe(null);
  });

  it("refuses a claimed row whose exam slug is test content, via the id → slug map social-publish builds", () => {
    const examSlugById = { real: "ssc-cgl", bad: "zz-test-government-exam" };
    expect(testContentRefusal({ examSlugById, sourceId: "bad", landingUrl: "https://x/sarkari-naukri/zz-test-government-exam" }))
      .toBe("reference test exam");
    expect(testContentRefusal({ examSlugById, sourceId: "real", landingUrl: "https://x/sarkari-naukri/ssc/ssc-cgl" })).toBe(null);
    // an id not in the map (a vacancy row) is decided by its landing URL, not silently passed
    expect(testContentRefusal({ examSlugById, sourceId: "vac-1", landingUrl: "https://x/sarkari-naukri/zz-test-vacancy-2026" }))
      .toBe("landing url points at reference test content");
  });

  it("refuses a landing URL that points at test content even when the record itself is real", () => {
    // the case a caller-supplied page_url opens up: a real exam, a test page.
    expect(testContentRefusal({ slug: "ssc-cgl", landingUrl: "https://x/sarkari-naukri/zz-test-vacancy-2026" }))
      .toBe("landing url points at reference test content");
  });

  it("never refuses a real exam on a real page, and never refuses nothing-at-all", () => {
    expect(testContentRefusal({ slug: "upssc-pet", landingUrl: "https://x/sarkari-naukri/upsssc-pet" })).toBe(null);
    expect(testContentRefusal({})).toBe(null);
  });
});

/**
 * Owner batch 8, H3 — the VACANCY candidate.
 *
 * The rule this file pins: a vacancy caption is built from the row's COLUMNS (title,
 * organisation, state, post count, last date, reader page) and NEVER from the notice
 * text — and a field that is missing is OMITTED rather than invented. An old row with
 * no end date must not grow a date line.
 */
describe("buildVacancyCaption — a vacancy caption from columns only", () => {
  const ROW = {
    title: "UP Health Department 108 Ambulance Driver 2026 – 1,200 Posts",
    organization: "108 Ambulance Service UP",
    stateLabel: "Uttar Pradesh",
    vacancyCount: 5244,
    applicationEndDate: "2026-09-15",
    pageUrl: "https://www.indianexaminfo.com/sarkari-naukri/up-swasthya-vibhag-ambulance-driver-2026",
  };

  it("carries the structured fields and nothing else", () => {
    const c = buildVacancyCaption(ROW);
    expect(c).toContain("<b>UP Health Department 108 Ambulance Driver 2026 – 1,200 Posts</b>");
    expect(c).toContain("108 Ambulance Service UP");
    expect(c).toContain("Uttar Pradesh");
    expect(c).toContain("5,244 posts");
    // The date goes through the SHARED formatDateIN (the same one the exam captions
    // use), which en-IN renders September as "Sept" — hence the loose month match.
    expect(c).toMatch(/Last date: 15 Sept? 2026/);
    expect(c).toContain("indianexaminfo.com/sarkari-naukri/up-swasthya-vibhag-ambulance-driver-2026");
  });

  it("OMITS a missing last date — it never invents one", () => {
    const c = buildVacancyCaption({ ...ROW, applicationEndDate: null });
    expect(c).not.toContain("Last date");
    expect(c).toContain("Uttar Pradesh");   // the other fields survive
    expect(c).toContain("5,244 posts");
  });

  it("omits an unknown post count instead of printing zero", () => {
    const c = buildVacancyCaption({ ...ROW, vacancyCount: null });
    expect(c).not.toContain("posts");
    expect(c).not.toContain("0 posts");
  });

  it("omits a missing organisation and a missing state", () => {
    const c = buildVacancyCaption({ ...ROW, organization: null, stateLabel: null });
    expect(c).not.toContain("108 Ambulance Service UP");
    expect(c).not.toContain("Uttar Pradesh");
    expect(c).toContain("Last date");
  });

  it("escapes Telegram HTML and clips to the hard max length", () => {
    const c = buildVacancyCaption({ ...ROW, title: "A & B <script>" });
    expect(c).toContain("&amp;");
    expect(c).toContain("&lt;script&gt;");
    expect(c).not.toContain("<script>");
    const long = buildVacancyCaption({ ...ROW, title: "N".repeat(2000) });
    expect(long.length).toBeLessThanOrEqual(TELEGRAM_CAPTION_MAX);
  });

  it("groups the post count the same way in every runtime", () => {
    expect(groupDigits(5244)).toBe("5,244");
    expect(groupDigits(120)).toBe("120");
    expect(groupDigits(1200000)).toBe("1,200,000");
  });
});

describe("the vacancy candidate's key and its test-content refusal", () => {
  it("the idempotency key is channel|source_type|source_id|event", () => {
    expect(idempotencyKey("telegram", VACANCY_SOURCE_TYPE, "v1", "published"))
      .toBe("telegram|sarkari_naukri|v1|published");
    expect(VACANCY_SOURCE_TYPE).toBe("sarkari_naukri");
  });

  it("refuses a vacancy whose OWN slug is test content, by id (the publish-side guard)", () => {
    const vacancySlugById = { v1: "zz-test-vacancy-2026", v2: "up-anganwadi-bharti-2026" };
    expect(testContentRefusal({ vacancySlugById, sourceId: "v1", landingUrl: "https://x/sarkari-naukri/zz-test-vacancy-2026" }))
      .toBe("reference test exam");
    expect(testContentRefusal({ vacancySlugById, sourceId: "v2", landingUrl: "https://x/sarkari-naukri/up-anganwadi-bharti-2026" }))
      .toBe(null);
  });

  it("a vacancy id is NOT decided by the exam map (the two source types do not mix)", () => {
    const examSlugById = { e1: "zz-test-entrance-exam" };
    expect(testContentRefusal({ examSlugById, sourceId: "v1", landingUrl: "https://x/sarkari-naukri/up-anganwadi-bharti-2026" }))
      .toBe(null);
  });
});
