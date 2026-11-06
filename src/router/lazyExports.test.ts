/**
 * lazyExports.test.ts — owner batch 7, Phase S. The class guard.
 *
 * The deployed CMS /social screen showed "Failed to load this page" because the router
 * resolves lazy pages BY NAME — lazyPage(() => import("…/SocialQueuePage"), "SocialQueuePage")
 * — while that module only had `export default`. The resolved component was undefined,
 * React threw while rendering the route, and the lazy error boundary hid it.
 *
 * Every other page follows the repo convention (`export function PageName`), so this one
 * mismatch was invisible until someone opened the screen. This test checks every lazyPage
 * entry in src/router/index.tsx against the module it points at, so the same mistake
 * cannot ship again on ANY route.
 *
 * Source text rather than runtime imports on purpose: importing all 38 page modules here
 * would drag in Supabase, the rich editor and SheetJS for a question that is about the
 * export SHAPE. The runtime side is pinned where it matters, in
 * src/pages/social/SocialQueuePage.mount.test.tsx, which really does the dynamic import.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROUTER = readFileSync(resolve(__dirname, "index.tsx"), "utf8");
const SRC = resolve(__dirname, "..");

interface Entry { spec: string; exportName: string; line: number }

const entries: Entry[] = [...ROUTER.matchAll(
  /lazyPage\(\s*\(\)\s*=>\s*import\("([^"]+)"\)\s*,\s*"([^"]+)"\s*\)/g,
)].map((m) => ({
  spec: m[1],
  exportName: m[2],
  line: ROUTER.slice(0, m.index).split("\n").length,
}));

function fileFor(spec: string): string | null {
  const base = resolve(SRC, spec.replace(/^@\//, ""));
  for (const p of [base + ".tsx", base + ".ts", resolve(base, "index.tsx"), resolve(base, "index.ts")]) {
    if (existsSync(p)) return p;
  }
  return null;
}

/** Does the module expose `name` as a value export React can render? */
function exportsName(body: string, name: string): boolean {
  // `lazyPage(..., "default")` is legal: GovtExamEditorPage re-exports another page's
  // component under `as default`, which is a real default export.
  if (name === "default") {
    return /export\s+default/.test(body) || /export\s*\{[^}]*\bas\s+default\b[^}]*\}/.test(body);
  }
  const forms = [
    new RegExp(`export\\s+(async\\s+)?function\\s+${name}\\s*[(<]`),
    new RegExp(`export\\s+(const|let|var)\\s+${name}\\s*[:=]`),
    // export { Local as Name } / export { Name }
    new RegExp(`export\\s*\\{[^}]*\\b(?:${name}\\s*\\}|as\\s+${name}\\b)`),
  ];
  return forms.some((re) => re.test(body));
}

describe("router lazy pages — every requested export really exists", () => {
  it("the router has a substantial number of lazy pages to guard", () => {
    expect(entries.length, "no lazyPage entries parsed — did the router shape change?").toBeGreaterThanOrEqual(30);
  });

  it("every lazyPage spec points at a file that exists", () => {
    for (const e of entries) {
      expect(fileFor(e.spec), `router line ${e.line}: ${e.spec} not found`).not.toBeNull();
    }
  });

  it.each(entries.map((e) => [`${e.exportName} from ${e.spec}`, e] as const))(
    "%s is exported by its module",
    (_label, e) => {
      const file = fileFor(e.spec)!;
      const body = readFileSync(file, "utf8");
      expect(
        exportsName(body, e.exportName),
        `router line ${e.line}: lazyPage asks for "${e.exportName}" but ${file.replace(SRC, "src")} ` +
        `does not export that name. React would render undefined and the error boundary would ` +
        `show "Failed to load this page".`,
      ).toBe(true);
    },
  );

  it("the page that broke in production exports BOTH shapes", () => {
    const body = readFileSync(resolve(SRC, "pages/social/SocialQueuePage.tsx"), "utf8");
    expect(exportsName(body, "SocialQueuePage"), "named export (what the router asks for)").toBe(true);
    expect(/export\s+default\s+SocialQueuePage/.test(body), "default export kept for other importers").toBe(true);
  });
});

describe("the router cannot fail silently again", () => {
  it("lazyPage rejects with a message naming the missing export instead of rendering undefined", () => {
    expect(ROUTER).toMatch(/typeof resolved !== "function"/);
    expect(ROUTER).toMatch(/does not export a component named/);
  });

  it("the error boundary logs what it catches (name, message, component stack)", () => {
    expect(ROUTER).toMatch(/console\.error\(\s*\n?\s*"\[cms\] page failed to load:/);
    expect(ROUTER).toMatch(/componentStack/);
  });

  it("the log carries no secret material: no token, key or credential read in the boundary", () => {
    const boundary = ROUTER.slice(ROUTER.indexOf("componentDidCatch"), ROUTER.indexOf("private handleReload"));
    // sessionStorage is the reload-loop guard and is not user data; nothing that could put
    // a key, token or password into the console is allowed here.
    for (const forbidden of ["access_token", "refresh_token", "apikey", "api_key", "anon_key",
                              "password", "secret", "localStorage", "supabase"]) {
      expect(boundary.toLowerCase(), `boundary must not touch "${forbidden}"`).not.toContain(forbidden);
    }
  });
});
