import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
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
