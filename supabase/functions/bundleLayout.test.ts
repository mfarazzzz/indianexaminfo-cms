/**
 * bundleLayout.test.ts — the deploy contract for the two social Edge Functions
 * (owner batch 5, P1).
 *
 * Both functions import `../_shared/social.ts`. Supabase deploys a function as a set of
 * files under `<upload-root>/source/` (the entrypoint is reported as
 * `.../source/index.ts`), and the read-back of the live deployment on 2026-10-29 showed the
 * sibling at `.../_shared/social.ts` — i.e. the import resolves ONE level up from the
 * entrypoint's directory, to exactly where the bundle puts it.
 *
 * That layout is not enforced by anything except the deploy call, so this test enforces it
 * in the repo: a relative parent import that has no file behind it is a function that fails
 * at cold start, and the only reason this project learned to check is that every other
 * function here is a single file — `ai-fill` imports `./templates.ts`, a same-directory
 * import, so the parent hop had never been exercised before.
 *
 * It also pins the invariant the shared file exists for: the CMS mirror of the test-slug rule
 * (src/lib/testContent.ts) and this file must not disagree about what `zz-test-` means.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..");           // the CMS repo root
const fns = ["social-candidate", "social-publish"] as const;

describe("the social functions' shared-module import resolves inside the bundle", () => {
  it.each(fns)("%s/index.ts imports ../_shared/social.ts and that file exists", (fn) => {
    const entry = resolve(ROOT, "supabase/functions", fn, "index.ts");
    const src = readFileSync(entry, "utf8");
    const spec = /from\s+"(\.\.\/[^"]+)"/.exec(src)?.[1];
    expect(spec, `${fn}/index.ts has no relative parent import`).toBeTruthy();
    expect(spec).toBe("../_shared/social.ts");

    // What the platform will resolve: entrypoint dir (`<root>/source`) + the spec.
    const resolvedFromEntrypoint = resolve(dirname(entry), spec as string);
    expect(existsSync(resolvedFromEntrypoint), `missing ${resolvedFromEntrypoint}`).toBe(true);

    // And the same path relative to the deployed bundle layout Supabase reports:
    // `<upload-root>/_shared/social.ts` next to `<upload-root>/source/index.ts`.
    const asPosix = resolvedFromEntrypoint.replace(/\\/g, "/");
    expect(asPosix).toContain("/_shared/social.ts");
    // the parent hop must land OUTSIDE source/ — that is the whole reason this is checked
    expect(asPosix).not.toContain("/source/_shared/");
  });

  it("every named import from the shared module is actually exported by it", () => {
    const shared = readFileSync(resolve(ROOT, "supabase/functions/_shared/social.ts"), "utf8");
    for (const fn of fns) {
      const src = readFileSync(resolve(ROOT, "supabase/functions", fn, "index.ts"), "utf8");
      const clause = /import\s*\{([^}]+)\}\s*from\s+"\.\.\/_shared\/social\.ts";/.exec(src);
      expect(clause, `${fn} no longer imports from the shared module — update this test`).toBeTruthy();
      const names = (clause as RegExpExecArray)[1]
        .split(",")
        .map((s) => s.replace(/^\s*type\s+/, "").trim())
        .filter(Boolean);
      expect(names.length, `${fn} imports nothing`).toBeGreaterThan(0);
      for (const n of names) {
        expect(
          new RegExp(`export\\s+(?:const|function|type|interface)\\s+${n}\\b`).test(shared),
          `${fn} imports ${n}, which ../_shared/social.ts does not export`,
        ).toBe(true);
      }
    }
  });

  it("the test-slug rule is identical in the CMS client and the shared edge module", () => {
    const client = readFileSync(resolve(ROOT, "src/lib/testContent.ts"), "utf8");
    const shared = readFileSync(resolve(ROOT, "supabase/functions/_shared/social.ts"), "utf8");
    const prefix = (src: string) => /TEST_SLUG_PREFIX\s*=\s*"([^"]+)"/.exec(src)?.[1];
    expect(prefix(shared), "the shared module lost the prefix constant").toBe(prefix(client));
    expect(prefix(client)).toBe("zz-test-");
    // same body, not just the same constant: prefix-of-lowercased-trimmed-slug
    const body = (src: string) => /function isTestSlug[\s\S]*?return ([^\n]+);/.exec(src)?.[1].replace(/\s+/g, " ");
    expect(body(shared)).toBe(body(client));
  });
});
