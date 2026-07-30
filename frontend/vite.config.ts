/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import stylex from "@stylexjs/unplugin";

// @stylexjs/unplugin's dev-mode transformIndexHtml hook builds its injected
// <script>/<link> URLs with Node's `path.join`, which emits backslashes on
// Windows. Browsers don't resolve those as relative URLs, so the two tags
// 404. The app doesn't depend on them (the runtime module imported from
// main.tsx injects the dev CSS itself), but this keeps the console clean.
// Only affects `vite dev`; production builds are unaffected.
const fixStylexWindowsPaths: Plugin = {
  name: "fix-stylex-windows-dev-paths",
  transformIndexHtml: {
    order: "post",
    handler: (html) =>
      html.replace(/(src|href)="([^"]*\\[^"]*)"/g, (_match, attr: string, value: string) => {
        // Collapse the whole separator run to a single "/": path.join on
        // Windows leaves doubled separators (its UNC-path convention) that
        // a plain backslash->slash swap would turn into an invalid
        // protocol-relative "//host" reference instead of a same-origin path.
        return `${attr}="${value.replace(/[\\/]+/g, "/")}"`;
      }),
  },
};

export default defineConfig({
  plugins: [stylex.vite(), react(), fixStylexWindowsPaths],
  server: {
    port: 3000,
    // Bind to all interfaces so the dev server is reachable from outside a
    // container; polling is opt-in since it's only needed when bind-mounted
    // file change events don't propagate (e.g. some Docker Desktop setups).
    host: true,
    watch: {
      usePolling: process.env.CHOKIDAR_USEPOLLING === "true",
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/main.tsx", "src/vite-env.d.ts", "src/**/*.test.{ts,tsx}"],
    },
  },
});
