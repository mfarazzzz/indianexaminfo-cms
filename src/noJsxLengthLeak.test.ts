/**
 * noJsxLengthLeak.test.ts — lint-style guard for the "renders a literal 0" bug.
 *
 * `{list?.length && <X/>}` prints "0" to the page when the list is empty, because 0
 * is a renderable React child. The fix is `{!!list?.length && ...}` or a ternary.
 * This fails if ANY .tsx under src/ renders a `.length &&` / `count &&` directly into
 * JSX (an `&&` whose left side is a `.length`/`count` and whose right side opens a
 * tag or paren). A line already booleanised with `!!` is the FIX, not a leak. Guard
 * conditions outside JSX (`if (!x.length && …) return`) are logic, not output, and the
 * regex only matches when a tag/paren follows, so they are allowed.
 *
 * The same test exists in indianexaminfo-frontend — the defect class is not
 * repo-specific, and a CMS list is just as capable of printing a stray 0.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".next") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const LEAK = /\.(?:length|count)\s+&&\s*[<(]/;

describe("no `.length &&` / `count &&` rendered into JSX", () => {
  it("no src/ .tsx leaks a bare length/count into JSX", () => {
    const files = walk(join(ROOT, "src"));
    expect(files.length, "the scan found no .tsx files — the guard is not running").toBeGreaterThan(50);
    const offenders: string[] = [];
    for (const f of files) {
      readFileSync(f, "utf8").split(/\r?\n/).forEach((line, i) => {
        if (LEAK.test(line) && !line.includes("!!")) {
          offenders.push(`${f.replace(ROOT, "")}:${i + 1}: ${line.trim().slice(0, 90)}`);
        }
      });
    }
    expect(offenders, "JSX length/count render leaks:\n" + offenders.join("\n")).toEqual([]);
  });
});
