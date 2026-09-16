import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { execSync } from "child_process";

/**
 * Build-time git stamp. Runs on the build machine (Vite config eval), so the
 * values bake into the bundle — no runtime git dependency. If git isn't
 * available (e.g. a tarball deploy), every field degrades to "unknown" rather
 * than failing the build.
 *
 * `sync` answers "did this build come from a commit that matches origin/main?":
 *  - "clean"  → HEAD === origin/main AND no uncommitted changes (a true release)
 *  - "ahead"  → local HEAD is a commit origin/main doesn't have yet
 *  - "behind" → origin/main has commits this build doesn't (stale build)
 *  - "dirty"  → uncommitted changes in the working tree at build time
 *  - "unknown"→ couldn't determine (no git / no remote ref)
 */
function gitStamp() {
  const run = (cmd: string) => {
    try { return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); }
    catch { return ""; }
  };

  const sha = run("git rev-parse --short HEAD") || "unknown";
  const time = new Date().toISOString();

  let sync = "unknown";
  const head = run("git rev-parse HEAD");
  const dirty = run("git status --porcelain");
  const origin = run("git rev-parse origin/main");
  if (head && origin) {
    if (dirty) sync = "dirty";
    else if (head === origin) sync = "clean";
    else {
      // Is origin/main an ancestor of HEAD? → we're ahead. Else behind/diverged.
      const aheadOfOrigin = run(`git merge-base --is-ancestor ${origin} ${head} && echo yes`);
      sync = aheadOfOrigin === "yes" ? "ahead" : "behind";
    }
  } else if (head && dirty) {
    sync = "dirty";
  }

  return { sha, time, sync };
}

const stamp = gitStamp();

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_SHA__: JSON.stringify(stamp.sha),
    __BUILD_TIME__: JSON.stringify(stamp.time),
    __BUILD_SYNC__: JSON.stringify(stamp.sync),
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: { port: 5173 },
  preview: { port: 4173 },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor":  ["react", "react-dom"],
          "router":        ["react-router-dom"],
          "supabase":      ["@supabase/supabase-js"],
          "editor":        ["@tiptap/react", "@tiptap/starter-kit"],
          "charts":        ["recharts"],
          "dnd":           ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
          "forms":         ["react-hook-form", "@hookform/resolvers", "zod"],
        },
      },
    },
  },
});
