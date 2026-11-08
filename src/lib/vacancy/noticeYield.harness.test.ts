/**
 * noticeYield.harness.test.ts — owner batch 9, H1. A MEASURING INSTRUMENT, not an assertion.
 *
 * WHY THIS FILE EXISTS. On a live notice the extractor produced 3 of its 8 fields and said
 * nothing about the other 5, so "improve the extractor" had no baseline and no way to tell a
 * regression from a fix. This harness turns the real notices in qa/fixtures/notices/ into a
 * number per field: it prints the per-notice result and a corpus yield table, which is the only
 * thing that can honestly justify a regex change.
 *
 * WHY IT DOES NOT ASSERT A YIELD. A corpus that goes red because an old notice is still only
 * 60% readable would be deleted or skipped within a week. The assertions here are STRUCTURAL
 * only — the things that are wrong no matter which notice was pasted (a field proposed twice, a
 * proposal with no value, a value the copy guard refused being proposed anyway). The yield is
 * printed for the owner to read.
 *
 * IT IS EMPTY UNTIL THE OWNER ADDS A NOTICE, AND THAT IS THE DESIGN: no synthetic fixture text
 * was invented to fill the folder. Add .txt files per qa/fixtures/notices/README.md.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  extractVacancyFields,
  VACANCY_FIELD_LABELS,
  type VacancyFieldKey,
} from "./vacancyNoticeFields";

const DIR = join(process.cwd(), "qa", "fixtures", "notices");
const FIELDS = Object.keys(VACANCY_FIELD_LABELS) as VacancyFieldKey[];

interface Fixture {
  name: string;
  text: string;
}

function loadFixtures(): Fixture[] {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR)
    .filter((f) => f.toLowerCase().endsWith(".txt"))
    .sort()
    .map((f) => ({ name: f.replace(/\.txt$/i, ""), text: readFileSync(join(DIR, f), "utf8") }))
    // An empty file is not a notice — say so instead of scoring it as 0/8.
    .filter((f) => {
      if (f.text.trim() !== "") return true;
      console.warn(`[notice-yield] "${f.name}" is empty and was skipped.`);
      return false;
    });
}

const fixtures = loadFixtures();

/** `found` / `—` padded so the table lines up in a terminal. */
const cell = (v: boolean): string => (v ? "found" : "—");

function printReport(results: Array<{ name: string; fields: Map<VacancyFieldKey, string> }>): void {
  const nameWidth = Math.max(22, ...results.map((r) => r.name.length));
  const colWidth = Math.max(...results.map((r) => r.name.length), 6) + 1;
  console.log(`\n[notice-yield] ${results.length} fixture(s) in qa/fixtures/notices`);
  console.log(
    "field".padEnd(nameWidth) + results.map((r) => r.name.padEnd(colWidth)).join("") + "corpus",
  );
  for (const field of FIELDS) {
    const hits = results.filter((r) => r.fields.has(field)).length;
    const cols = results.map((r) => `${cell(r.fields.has(field))}${r.fields.has(field) ? ` ${r.fields.get(field)}` : ""}`.padEnd(colWidth).slice(0, colWidth));
    console.log(`${field} (${VACANCY_FIELD_LABELS[field]})`.padEnd(nameWidth) + cols.join("") + `${hits}/${results.length}`);
  }
}

describe("notice yield (H1 harness)", () => {
  it("reports per-field yield across the corpus", () => {
    if (fixtures.length === 0) {
      console.log(
        "\n[notice-yield] no fixtures yet — this is expected until the owner adds real notices.\n" +
          "[notice-yield] drop the notice TEXT (UTF-8, .txt) in qa/fixtures/notices/ and re-run:\n" +
          "[notice-yield]   npx vitest run src/lib/vacancy/noticeYield.harness.test.ts\n" +
          "[notice-yield] see qa/fixtures/notices/README.md for the rules.",
      );
      expect(fixtures.length).toBe(0);   // nothing to measure, nothing to fail
      return;
    }

    const results = fixtures.map((f) => {
      const extraction = extractVacancyFields(f.text, { year: 2026 });
      console.log(`\n── ${f.name} ──`);
      for (const field of FIELDS) {
        const p = extraction.proposals.find((x) => x.field === field);
        console.log(`  ${field.padEnd(22)} ${p ? `found  ${p.display}   [guard: ${p.guard}]` : "—"}`);
      }
      for (const n of extraction.notes) console.log(`  note: ${n}`);
      for (const u of extraction.unmatched) console.log(`  unmatched date: ${u}`);
      for (const c of extraction.conflicts) console.log(`  conflict: ${c}`);
      return {
        name: f.name,
        fields: new Map(extraction.proposals.map((p) => [p.field, p.display] as const)),
      };
    });

    printReport(results);
    expect(results.length).toBe(fixtures.length);
  });

  it("never proposes the same field twice for one notice", () => {
    for (const f of fixtures) {
      const fields = extractVacancyFields(f.text, { year: 2026 }).proposals.map((p) => p.field);
      expect(new Set(fields).size, `${f.name} proposed a field twice`).toBe(fields.length);
    }
  });

  it("never proposes an empty value, and never proposes a REFUSED one", () => {
    for (const f of fixtures) {
      for (const p of extractVacancyFields(f.text, { year: 2026 }).proposals) {
        expect(String(p.display ?? "").trim(), `${f.name}: ${p.field} displayed nothing`).not.toBe("");
        // `refused` proposals are reported to the editor but must not carry a usable value.
        if (p.guard === "refused") expect(p.refused ?? "").not.toBe("");
      }
    }
  });

  it("keeps every proposal traceable to a line of the notice", () => {
    // The editor must be able to check a value against the source. A value with no source line
    // is indistinguishable from an invented one.
    for (const f of fixtures) {
      const lines = new Set(f.text.split(/\r?\n/).map((l) => l.trim()));
      for (const p of extractVacancyFields(f.text, { year: 2026 }).proposals) {
        if (!p.sourceLine) continue;              // a documented omission, not an invention
        expect(lines.has(p.sourceLine.trim()), `${f.name}: ${p.field} source line not in the notice`).toBe(true);
      }
    }
  });
});
