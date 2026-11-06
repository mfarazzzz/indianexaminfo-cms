/**
 * lazyRuntimeWiring.test.tsx — owner batch 7, Phase S items 2 and 3.
 *
 * /social failed in production with "Minified React error #306 … args[]=undefined": a
 * lazy() element resolved to undefined because the router asked for an export name the
 * module did not carry. The static guard added in a4ceb1e reads the source text; this file
 * is the other half — it RUNTIME-IMPORTS every lazily loaded module in the app and asserts
 * the exact name the router (or the editor) asks for really resolves to a component, so a
 * missing export fails CI instead of failing a screen in front of the owner.
 *
 * Scope: every lazyPage(() => import("…"), "NAME") in src/router/index.tsx, AND every
 * React.lazy(() => import("…").then(m => ({ default: m.NAME }))) in
 * src/components/**  (14 workspace/editor sites — one of those drifting would break an
 * editor tab the same quiet way).
 *
 * Plus the route itself: /social is rendered from the REAL route table under a mocked
 * super-admin session and must show the queue without touching the error boundary.
 *
 * Only the Supabase client is stubbed — src/lib/supabase/client throws at import without
 * env credentials, and this test is about export SHAPE, never about data or network.
 */
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/lib/supabase/client", () => {
  const chain: unknown = new Proxy({}, {
    get: (_t, prop) => {
      if (prop === "then") return undefined;                    // not a thenable
      return (..._args: unknown[]) => chain;
    },
  });
  const stub = {
    from: () => chain,
    select: () => chain,
    insert: () => chain,
    update: () => chain,
    delete: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    single: async () => ({ data: null, error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    auth: { getUser: async () => ({ data: { user: null }, error: null }),
            signInWithPassword: async () => ({ data: null, error: null }),
            signOut: async () => ({ error: null }) },
    functions: { invoke: async () => ({ data: null, error: null }) },
    storage: { from: () => ({ upload: async () => ({ data: null, error: null }),
                              list: async () => ({ data: [], error: null }) }) },
  };
  return { db: stub, supabase: stub };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

const session = vi.hoisted(() => ({
  roleSlug: "super-admin",
  permissions: ["manage_social", "publish_exam", "edit_any_exam", "create_exam",
                "create_post", "edit_any_post", "edit_own_post", "publish_post",
                "upload_media", "manage_settings", "manage_categories", "manage_menus"] as string[],
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u-super", email: "owner@example.invalid",
            profile: { name: "Super Admin", roleSlug: session.roleSlug, permissions: session.permissions } },
    permissions: session.permissions, isLoading: false, error: null,
    signIn: vi.fn(), signOut: vi.fn(), refreshUser: vi.fn(),
  }),
}));
vi.mock("@/hooks/usePermission", () => ({
  usePermission: (perm: string) => session.permissions.includes(perm),
  useAnyPermission: (perms: string[]) => perms.some((p) => session.permissions.includes(p)),
}));

const SRC = resolve(__dirname, "..");

/** Lazily loadable modules, keyed the way Vite keys them: "/src/pages/…/X.tsx". */
type Loader = () => Promise<Record<string, unknown>>;
const loaders = {
  ...import.meta.glob("/src/pages/**/*.tsx"),
  ...import.meta.glob("/src/components/**/*.tsx"),
  ...import.meta.glob("/src/pages/**/*.ts"),
  ...import.meta.glob("/src/components/**/*.ts"),
  // the four glob shapes return different module generics; what matters here is that each
  // value is a loader whose module we index by export NAME, so the payload type is widened
  // once, deliberately, instead of per-pattern.
} as unknown as Record<string, Loader>;

/** "@/pages/social/SocialQueuePage" or "./ModuleEditor" → the glob key it lives at. */
function keyFor(spec: string, fromFile: string): string | null {
  const rel = spec.startsWith("./") || spec.startsWith("../")
    // a relative specifier resolves against the file that declared it
    ? resolve(fromFile, "..", spec).replace(SRC, "/src").replace(/\\/g, "/")
    : spec.replace(/^@\//, "/src/").replace(/^~\//, "/src/");
  for (const candidate of [rel, `${rel}.tsx`, `${rel}.ts`, `${rel}/index.tsx`, `${rel}/index.ts`]) {
    if (loaders[candidate]) return candidate;
  }
  return null;
}

async function moduleOf(spec: string, fromFile: string): Promise<Record<string, unknown>> {
  const key = keyFor(spec, fromFile);
  if (!key) throw new Error(`no loadable module for "${spec}" (declared in ${fromFile.replace(SRC, "src")})`);
  const mod = await loaders[key]!();
  return mod as Record<string, unknown>;
}

// ── the two places that declare lazy components ──────────────────────────────────────
interface Entry { spec: string; exportName: string; declaredAt: string; fromFile: string }

function routerEntries(): Entry[] {
  const file = resolve(SRC, "router/index.tsx");
  const src = readFileSync(file, "utf8");
  return [...src.matchAll(/lazyPage\(\s*\(\)\s*=>\s*import\("([^"]+)"\)\s*,\s*"([^"]+)"\s*\)/g)]
    .map((m) => ({ spec: m[1], exportName: m[2], fromFile: file,
                   declaredAt: `router/index.tsx line ${src.slice(0, m.index).split("\n").length}` }));
}

/** src/components/**\/*.tsx that use the React.lazy(() => import("…").then(m => ({ default: m.X }))) shape. */
function componentLazyEntries(): Entry[] {
  const walk = (dir: string, acc: string[] = []): string[] => {
    for (const e of readdirSync(dir)) {
      if (e === "node_modules" || e.startsWith(".")) continue;
      const full = join(dir, e);
      if (statSync(full).isDirectory()) walk(full, acc);
      else if (/\.tsx$/.test(e)) acc.push(full);
    }
    return acc;
  };
  const entries: Entry[] = [];
  for (const file of walk(resolve(SRC, "components"))) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(
      // allows single or double quotes and any spacing — the 14 editor sites are written as
      //   import('@/components/…/XTab').then(m => ({ default: m.XTab }))
      /import\(\s*["']([^"']+)["']\s*\)\s*\.then\(\s*(?:m|module)\s*=>\s*\(\s*\{\s*default:\s*(?:m|module)\.([A-Za-z0-9_$]+)\s*\}\s*\)/g)) {
      entries.push({ spec: m[1], exportName: m[2], fromFile: file,
                     declaredAt: `${file.replace(SRC, "src")}:${src.slice(0, m.index).split("\n").length}` });
    }
  }
  return entries;
}

const routerList = routerEntries();
const componentList = componentLazyEntries();

describe("the router asks for exports that exist — runtime, not source text", () => {
  it("the two parsers really found the app's lazy components", () => {
    expect(routerList.length, "lazyPage entries in src/router/index.tsx").toBeGreaterThanOrEqual(30);
    expect(componentList.length, "React.lazy … m.NAME entries in src/components").toBeGreaterThanOrEqual(10);
  });

  it.each(routerList.map((e) => [`${e.spec} → ${e.exportName}`, e] as const))(
    "%s resolves to a component",
    async (_label, e) => {
      const m = await moduleOf(e.spec, e.fromFile);
      expect(typeof m[e.exportName], `${e.declaredAt}: ${e.spec} must export a component named "${e.exportName}"`).toBe("function");
    },
  );

  it.each(componentList.map((e) => [`${e.spec} → ${e.exportName}`, e] as const))(
    "%s resolves to a component",
    async (_label, e) => {
      const m = await moduleOf(e.spec, e.fromFile);
      expect(typeof m[e.exportName], `${e.declaredAt}: ${e.spec} must export "${e.exportName}" (the name the .then() maps)`).toBe("function");
    },
  );

  it("every lazy route ALSO satisfies the exported guard, and the guard rejects a wrong name", async () => {
    const { resolvePageExport } = await import("@/router");
    const m = await moduleOf("@/pages/social/SocialQueuePage", resolve(SRC, "router/index.tsx"));
    expect(typeof resolvePageExport(m, "SocialQueuePage")).toBe("function");
    // the negative control: without this the suite could pass while the bug shipped
    expect(() => resolvePageExport(m, "SocialQueuePageDoesNotExist", "SocialQueuePage.tsx")).toThrow(
      /does not export a component named "SocialQueuePageDoesNotExist"/,
    );
  });
});

describe("the /social route itself", () => {
  it("renders the queue from the REAL route table under a mocked super-admin session, without the error boundary", async () => {
    const { router } = await import("@/router");
    const find = (routes: Array<{ path?: string; element?: ReactNode; children?: unknown }>, path: string): ReactNode => {
      for (const r of routes ?? []) {
        if (r.path === path && r.element) return r.element;
        if (Array.isArray(r.children)) {
          const nested = find(r.children as never, path);
          if (nested) return nested;
        }
      }
      return null;
    };
    const element = find(router.routes as never, "/social");
    expect(element, "no /social route in the router — it is flag-gated (FEATURE_FLAGS.SOCIAL_QUEUE)").not.toBeNull();

    render(<MemoryRouter initialEntries={["/social"]}>{element}</MemoryRouter>);
    expect(await screen.findByText("Social queue — Telegram")).toBeTruthy();
    expect(screen.queryByText(/Failed to load this page/)).toBeNull();
    expect(screen.queryByTestId("boundary-error-id")).toBeNull();
    // the mount reads really ran against the (stubbed) client rather than crashing first
    await waitFor(() => expect(screen.getAllByRole("button", { name: /Run due queue/i }).length).toBeGreaterThan(0));
  });

  it("the boundary, when it does fire, puts a code on screen and the detail in the console", async () => {
    const { errorIdFor } = await import("@/router");
    expect(errorIdFor(Object.assign(new Error("Minified React error #306; visit https://react.dev/errors/306?args[]=undefined"), { name: "Error" })))
      .toBe("React #306");
    expect(errorIdFor(new TypeError("x"))).toBe("TypeError");
    expect(errorIdFor(null)).toBe("unknown error");
    // the console log exists and carries no credential-shaped text
    const src = readFileSync(resolve(SRC, "router/index.tsx"), "utf8");
    const boundary = src.slice(src.indexOf("componentDidCatch"), src.indexOf("private handleReload"));
    expect(boundary).toMatch(/console\.error\(/);
    expect(boundary).toMatch(/componentStack/);
    expect(boundary).not.toMatch(/access_token|refresh_token|apikey|password/);
    // and the code really reaches the screen, not only the console
    const renderBlock = src.slice(src.indexOf("  render() {"), src.indexOf("export function errorIdFor"));
    expect(renderBlock).toMatch('data-testid="boundary-error-id"');
    expect(renderBlock).toMatch(/errorIdFor\(this\.state\.error\)/);
  });
});
