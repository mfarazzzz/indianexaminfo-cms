/**
 * vacancySlug.test.ts — the slug pattern, pinned against the REAL corpus rows
 * (read-only census on 2026-11-08: 361 live vacancies).
 */
import { describe, it, expect } from "vitest";
import {
  stateToken,
  proposeVacancySlug,
  vacancySubject,
  isVacancySlugShape,
} from "./vacancySlug";

describe("stateToken — the corpus's own state tokens", () => {
  // The EXPECTED values below are the live corpus's own counts (2026-11-08 census,
  // 361 rows): up 86/87, mp 28/31, andhra-pradesh 3/3, west-bengal 8/8, tamil-nadu
  // 6/6, himachal-pradesh 1/1, chhattisgarh 8/10. The FIRST version of this file
  // asserted "andhra", "himachal", "tamil" and "west" — the label's first word — and
  // the census disproved all four: the corpus spells those states out IN FULL.
  it.each([
    ["uttar-pradesh", "Uttar Pradesh", "up"],
    ["madhya-pradesh", "Madhya Pradesh", "mp"],
    ["andhra-pradesh", "Andhra Pradesh", "andhra-pradesh"],
    ["himachal-pradesh", "Himachal Pradesh", "himachal-pradesh"],
    ["tamil-nadu", "Tamil Nadu", "tamil-nadu"],
    ["west-bengal", "West Bengal", "west-bengal"],
    ["rajasthan", "Rajasthan", "rajasthan"],
    ["bihar", "Bihar", "bihar"],
    ["maharashtra", "Maharashtra", "maharashtra"],
    ["chhattisgarh", "Chhattisgarh", "chhattisgarh"],
  ])("%s → %s", (slug, label, expected) => {
    expect(stateToken(slug, label)).toBe(expected);
  });

  it("gives All-India vacancies NO state token (their slug starts with the body token)", () => {
    expect(stateToken("all-india", "All India")).toBe("");
  });
});

describe("vacancySubject — the title minus the corpus's noise", () => {
  it("drops the post-count clause, the 'via' clause and the document word", () => {
    expect(vacancySubject("Rajasthan Gram Sevak Recruitment 2026 – 4,200 Posts via RSMSSB"))
      .toBe("rajasthan-gram-sevak-2026");
    expect(vacancySubject("UP Nagar Nigam Driver Recruitment 2026 Lucknow & Agra – 280 Posts"))
      .toBe("up-nagar-nigam-driver-2026-lucknow-agra");
  });
});

describe("proposeVacancySlug — the corpus's shape", () => {
  it("reproduces a real corpus row (West Bengal Anganwadi 2026 South 24 Parganas)", () => {
    const slug = proposeVacancySlug({
      title: "West Bengal Anganwadi 2026 South 24 Parganas – 720 Posts",
      state: "west-bengal",
      stateLabel: "West Bengal",
      year: 2026,
    });
    expect(slug).toBe("west-bengal-anganwadi-2026-south-24-parganas");
    expect(isVacancySlugShape(slug)).toBe(true);
  });

  it("reproduces a real corpus row (Bihar NHM Lab Technician 2026 All Districts)", () => {
    const slug = proposeVacancySlug({
      title: "Bihar NHM Lab Technician 2026 All Districts – 1,800 Posts",
      state: "bihar",
      stateLabel: "Bihar",
      year: 2026,
    });
    expect(slug).toBe("bihar-nhm-lab-technician-2026-all-districts");
  });

  it("reproduces a real corpus row (Rajasthan Police Constable Driver 2026)", () => {
    const slug = proposeVacancySlug({
      title: "Rajasthan Police Constable Driver Recruitment 2026 – 750 Posts",
      state: "rajasthan",
      stateLabel: "Rajasthan",
      year: 2026,
    });
    expect(slug).toBe("rajasthan-police-constable-driver-2026");
  });

  it("reproduces a real corpus row (Andhra Pradesh Grama Sachivalayam 2026)", () => {
    const slug = proposeVacancySlug({
      title: "Andhra Pradesh Grama Sachivalayam 2026",
      state: "andhra-pradesh",
      stateLabel: "Andhra Pradesh",
      year: 2026,
    });
    expect(slug).toBe("andhra-pradesh-grama-sachivalayam-2026");
  });

  it("DROPS the spelled-out state for an ABBREVIATED one (never 'up-uttar-pradesh-…')", () => {
    const slug = proposeVacancySlug({
      title: "Uttar Pradesh Police Constable Recruitment 2026",
      state: "uttar-pradesh",
      stateLabel: "Uttar Pradesh",
      year: 2026,
    });
    expect(slug).toBe("up-police-constable-2026");
    expect(slug).not.toContain("uttar-pradesh");
  });

  it("drops the spelled-out state for madhya-pradesh as well ('mp-…', never 'mp-madhya-…')", () => {
    const slug = proposeVacancySlug({
      title: "Madhya Pradesh Lineman Recruitment 2026 – 2,800 Posts",
      state: "madhya-pradesh",
      stateLabel: "Madhya Pradesh",
      year: 2026,
    });
    expect(slug).toBe("mp-lineman-2026");
  });

  it("never repeats the state when the title carries it in the middle", () => {
    const slug = proposeVacancySlug({
      title: "NHM Lab Technician Bihar 2026 All Districts",
      state: "bihar",
      stateLabel: "Bihar",
      year: 2026,
    });
    expect(slug).toBe("bihar-nhm-lab-technician-2026-all-districts");
    expect(slug.split("bihar")).toHaveLength(2);
  });

  it("puts the state token first when the title does not carry it", () => {
    const slug = proposeVacancySlug({
      title: "Constable GD Recruitment 2026",
      state: "uttar-pradesh",
      stateLabel: "Uttar Pradesh",
      year: 2026,
    });
    expect(slug.startsWith("up-")).toBe(true);
    expect(slug.endsWith("-2026")).toBe(true);
  });

  it("appends the year when the title carries none", () => {
    const slug = proposeVacancySlug({
      title: "SSC Junior Engineer",
      state: "all-india",
      stateLabel: "All India",
      year: 2026,
    });
    expect(slug).toBe("ssc-junior-engineer-2026");
  });

  it("never exceeds the cap and never emits a double dash", () => {
    const slug = proposeVacancySlug({
      title: "A very long vacancy title that keeps going and going and going and going for a while indeed yes",
      state: "uttar-pradesh",
      stateLabel: "Uttar Pradesh",
      year: 2026,
    });
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug).not.toContain("--");
    expect(isVacancySlugShape(slug)).toBe(true);
  });
});
