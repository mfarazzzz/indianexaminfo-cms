/**
 * corsWiring.test.ts — the CORS contract of the two social Edge Functions
 * (owner batch 9, P1).
 *
 * WHY A SOURCE-LEVEL TEST. These two files cannot be imported by vitest: they call
 * `Deno.serve` at module scope and read `Deno.env`. The pure half of the fix
 * (`corsFor` / `preflightFor` / `jsonWith`) is unit-tested in `_shared/social.test.ts`;
 * what is left to verify is the WIRING — that the preflight is answered before the
 * bearer check, and that no response path escapes without the headers. That is a
 * property of the file's text, so it is checked as text.
 *
 * This is the regression that actually happened: the functions answered only
 * `content-type`, the CMS's cross-origin preflight got a 401 with no
 * Access-Control-Allow-Origin, and supabase-js surfaced
 * "Failed to send a request to the Edge Function" instead of the function's own error.
 * Proven live 2026-11-08 06:10Z — `OPTIONS social-publish` → 401 with no
 * Access-Control-*, while `OPTIONS ai-fill` → 200 with the headers.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FUNCTIONS = resolve(__dirname);
const fns = ["social-candidate", "social-publish"] as const;

const src = (fn: string) => readFileSync(resolve(FUNCTIONS, fn, "index.ts"), "utf8");
const at = (text: string, needle: string) => {
  const i = text.indexOf(needle);
  expect(i, `"${needle}" not found in the function`).toBeGreaterThanOrEqual(0);
  return i;
};

describe("both social functions handle the browser preflight (P1)", () => {
  it.each(fns)("%s imports the shared CORS helpers", (fn) => {
    const s = src(fn);
    for (const helper of ["corsFor", "jsonWith", "preflightFor"]) {
      expect(
        new RegExp(`import[\\s\\S]*\\b${helper}\\b[\\s\\S]*from "\\.\\./_shared/social\\.ts"`).test(s),
        `${fn} does not import ${helper} from ../_shared/social.ts`,
      ).toBe(true);
    }
  });

  it.each(fns)("%s answers OPTIONS BEFORE it checks the bearer token", (fn) => {
    const s = src(fn);
    // The preflight carries no Authorization header by design: answering it after the
    // auth check is the exact bug. Position in the file is the property that matters.
    expect(at(s, "preflightFor(")).toBeLessThan(at(s, 'startsWith("Bearer ")'));
    expect(s).toContain("if (pre) return pre;");
  });

  it.each(fns)("%s refuses a foreign browser origin before doing any work", (fn) => {
    const s = src(fn);
    expect(at(s, "corsFor(")).toBeLessThan(at(s, 'startsWith("Bearer ")'));
    expect(s).toContain("if (!cors.allowed)");
  });

  it.each(fns)("%s routes every JSON response through the CORS-stamping helper", (fn) => {
    const s = src(fn);
    // The local alias is what makes "forgetting the header on one path" impossible.
    expect(s).toContain("const json = (o: unknown, status = 200) => jsonWith(o, status, cors.headers);");
    // No hand-rolled JSON response may survive: that is how the original bug got in.
    expect(s).not.toContain("new Response(JSON.stringify");
    // …and no module-level `json()` without CORS.
    expect(s).not.toMatch(/^function json\(/m);
    // Every early return still goes through the alias.
    expect((s.match(/return (await )?json\(/g) ?? []).length).toBeGreaterThan(0);
  });

  it.each(fns)("%s rejects a non-POST with a CORS-carrying 405", (fn) => {
    expect(src(fn)).toContain('jsonWith({ ok: false, error: "Method not allowed" }, 405, cors.headers)');
  });
});

describe("check_channel is read-only and reachable with the kill switch on (P3)", () => {
  const s = src("social-publish");

  it("the check runs before the kill_switch short-circuit", () => {
    // A check posts nothing, and the moment an operator needs it is while the switch is
    // still on — so the switch must not swallow it.
    expect(at(s, 'body.action === "check_channel"')).toBeLessThan(at(s, "if (cfg?.kill_switch)"));
  });

  it("it can only read: no posting method is reachable from the check", () => {
    const start = at(s, "async function checkChannel");
    const body = s.slice(start);
    for (const write of [
      "sendMessage", "sendPhoto", "sendDocument", "sendMediaGroup",
      "sendVideo", "sendAudio", "sendAnimation", "copyMessage",
    ]) {
      expect(body, `checkChannel must never call ${write}`).not.toContain(write);
    }
    // …and exactly the three read methods it is allowed to use.
    expect(body).toContain('call("getChat"');
    expect(body).toContain('call("getMe"');
    expect(body).toContain('call("getChatMember"');
  });

  it("it redacts the token out of every error string it handles", () => {
    const body = s.slice(at(s, "async function checkChannel"));
    // A failing fetch's message can contain the request URL, and that URL holds the
    // token — so the description is redacted before it is stored or returned.
    expect(body).toContain("redactError(String(j?.description");
    expect(body).toContain("redactError(String(e), token)");
    // The token must never be interpolated into anything but the request URL.
    expect(body).toContain("https://api.telegram.org/bot${token}/${method}");
    expect(body).not.toContain("JSON.stringify({ token");
  });

  it("it re-checks super-admin in the function, not only in the CMS", () => {
    const body = s.slice(at(s, "async function checkChannel"));
    expect(body).toContain('caller.rpc("current_user_role")');
    expect(body).toContain('role !== "super-admin"');
  });
});
