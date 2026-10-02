import { defineConfig, type Plugin } from "vite";
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
      // Is origin/main an ancestor of HEAD? -> we're ahead. Else behind/diverged.
      const aheadOfOrigin = run(`git merge-base --is-ancestor ${origin} ${head} && echo yes`);
      sync = aheadOfOrigin === "yes" ? "ahead" : "behind";
    }
  } else if (head && dirty) {
    sync = "dirty";
  }

  // Keep the offending file list so a dirty build can name it in the log.
  const dirtyFiles = dirty ? dirty.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];
  return { sha, time, sync, dirtyFiles };
}

const stamp = gitStamp();

/**
 * Emits <meta name="build" content="<sha> <sync> <iso time>"> into the built
 * index.html (view-source, no login) so "which commit is live?" is a one-glance
 * check — mirroring the frontend root layout. On a dirty build it also prints
 * the `git status --porcelain` file list to the build log, so Hostinger's log
 * shows exactly what dirtied the tree.
 *
 * The content string is built inline because a composite project
 * (tsconfig.node.json owns vite.config.ts) may not import a src/ module.
 * The canonical, unit-tested formatter is src/config/buildStamp.ts
 * (formatBuildStampContent) — keep the two in sync; buildStamp.test.ts pins
 * the exact shape this reproduces.
 */
function buildStampPlugin(): Plugin {
  const metaContent =
    !stamp.sha || stamp.sha === "unknown"
      ? "dev"
      : [stamp.sha, stamp.sync, stamp.time].filter(Boolean).join(" ");
  return {
    name: "build-stamp",
    buildStart() {
      if (stamp.sync === "dirty" && stamp.dirtyFiles.length) {
        this.info(
          `[build-stamp] working tree DIRTY — ${stamp.dirtyFiles.length} uncommitted file(s) ` +
            `(git status --porcelain):\n  ${stamp.dirtyFiles.join("\n  ")}`,
        );
      }
    },
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          attrs: { name: "build", content: metaContent },
          injectTo: "head",
        },
      ];
    },
  };
}

export default defineConfig({
  plugins: [react(), buildStampPlugin()],
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
